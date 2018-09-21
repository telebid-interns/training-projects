import datetime

import openpyxl

from pachu.config import config
from pachu.err import assertPeer

DEFAULT_TRANSFERRED_DELTA = datetime.timedelta(weeks=4)
ALLOWED_TRANSFERRED_DELTA = datetime.timedelta(weeks=52)


def export_credit_history(
        cursor, *,
        v,
        api_key,
        fly_from=None,
        fly_to=None,
        date_from=None,
        date_to=None,
        transferred_from=None,
        transferred_to=None,
        status=None,
        transfer_amount=None,
        transfer_amount_operator=None,
        group_by=None
):
    # TODO authorization
    transferred_to = transferred_to or datetime.datetime.now()
    transferred_from = (transferred_from or
                        transferred_to - DEFAULT_TRANSFERRED_DELTA)

    exceeded_format_msg = 'Transferred date range exceeded {}'.format(
        ALLOWED_TRANSFERRED_DELTA)
    assertPeer(transferred_to - transferred_from > ALLOWED_TRANSFERRED_DELTA,
               msg=exceeded_format_msg,
               code='API_CH_EXCEEDED_TRANSFERRED_DELTA')

    query_params = dict(
        status=status,
        date_from=date_from,
        date_to=date_to,
        transferred_from=transferred_from,
        transferred_to=transferred_to,
        transfer_amount=transfer_amount,
        fly_from=fly_from,
        fly_to=fly_to,
    )
    filters = dict(
        status_filter='AND users_subscriptions.active=%(status)s',
        date_from_filter='AND users_subscriptions.date_from >= %(date_from)s',
        date_to_filter='AND users_subscriptions.date_to <= %(date_to)s',
        transferred_at_filter='''
        AND account_transfers.transferred_at BETWEEN 
            (%(transferred_from)s AND %(transferred_to)s)
        ''',
        transfer_amount_fitler='''
        AND account_transfers.transfer_amount {transfer_amount_operator} %(transfer_amount)s
        '''.format(transfer_amount_operator=transfer_amount_operator),
        airport_from_filter='''
        AND (ap_from.name=%(fly_from)s OR ap_from.iata_code=%(fly_from)s)
        ''',
        airport_to_filter='''
        AND (ap_to.name=%(fly_to)s OR ap_to.iata_code=%(fly_to)s)
        '''
    )
    select_columns = '*'
    group_by_clause = ''
    query = '''
    SELECT {select_columns}
    FROM (
        SELECT 
            users_subscriptions.active,
            'initial tax' AS reason,
            subscription_plan_id,
            transfer_amount,
            transferred_at,
            airport_from_id,
            airport_to_id, 
            date_from,
            date_to,
            users_subscriptions.id AS user_subscr_id
        FROM account_transfers
        JOIN user_subscription_account_transfers AS usat
          ON account_transfers.id=usat.account_transfer_id
        JOIN users_subscriptions 
            ON usat.user_subscription_id=users_subscriptions.id
                {status_filter}
                {date_from_filter}
                {date_to_filter}
        JOIN subscriptions
            ON users_subscriptions.subscription_id=subscriptions.id
        WHERE account_transfers.user_id=$userId
            {transferred_at_filter}
            {transfer_amount_filter}
        UNION ALL
        SELECT 
            users_subscriptions.active,
            'fetch tax' AS reason,
            subscription_plan_id,
            transfer_amount,
            transferred_at,
            airport_from_id,
            airport_to_id, 
            date_from,
            date_to,
            users_subscriptions.id AS user_subscr_id
        FROM account_transfers
        JOIN subscriptions_fetches_account_transfers AS sfat 
            ON account_transfers.id=sfat.account_transfer_id
        JOIN subscriptions_fetches 
            ON sfat.subscription_fetch_id=subscriptions_fetches.id
        JOIN subscriptions 
            ON subscriptions_fetches.subscription_id=subscriptions.id
        JOIN users_subscriptions 
            ON subscriptions.id=users_subscriptions.subscription_id 
                {status_filter}
                {date_from_filter}
                {date_to_filter}
        WHERE account_transfers.user_id=$userId 
            {transferred_at_filter}
            {transfer_amount_filter}
    ) AS taxes
    JOIN airports AS ap_from
      ON taxes.airport_from_id=ap_from.id
        ${airport_from_filter}
    JOIN airports AS ap_to
      ON taxes.airport_to_id=ap_to.id
        ${airport_to_filter}
    ${group_by_clause}
    ORDER BY 1 DESC
    '''.format(
        **filters,
        group_by_clause = group_by_clause,
        select_columns = select_columns,
    )
    cursor.execute(query, query_params)
