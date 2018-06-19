# This is an auto-generated Django model module.
# You'll have to do the following manually to clean this up:
#   * Rearrange models' order
#   * Make sure each model has one field with primary_key=True
#   * Make sure each ForeignKey has `on_delete` set to the desired behavior.
#   * Remove `managed = False` lines if you wish to allow Django to create, modify, and delete the table
# Feel free to rename the models, but don't rename db_table values or field names.
import collections

from django.db import models
from django.db import connection


class Municipalities(models.Model):
    id = models.CharField(primary_key=True, max_length=3)
    name = models.CharField(max_length=25)

    class Meta:
        managed = False
        db_table = 'municipalities'

    def tabulate(self):
        return {'id': self.id, 'name': self.name}


class Provinces(models.Model):
    id = models.CharField(primary_key=True, max_length=5)
    municipal = models.ForeignKey(Municipalities, models.PROTECT)
    name = models.CharField(max_length=25)

    class Meta:
        managed = False
        db_table = 'provinces'


class Ekatte(models.Model):
    id = models.CharField(primary_key=True, max_length=5)
    province = models.ForeignKey(Provinces, models.PROTECT)
    name = models.CharField(max_length=25)
    kind = models.CharField(max_length=1)
    altitude = models.SmallIntegerField()

    class Meta:
        managed = False
        db_table = 'ekatte'


FullEkatte = collections.namedtuple('FullEkatte', ['id', 'municipality', 'province', 'name', 'kind', 'altitude'])


def total(model):
    with connection.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) FROM {table_name};".format(table_name=model._meta.db_table))
        return cursor.fetchone()[0]


def full_ekatte_data(search_keywords=None):
    query = """SELECT ekatte.id, municipalities.name, provinces.name, ekatte.name, ekatte.kind, ekatte.altitude
    FROM ekatte JOIN provinces ON ekatte.province_id = provinces.id JOIN municipalities ON provinces.municipal_id=municipalities.id
    """
    with connection.cursor() as cursor:
        if search_keywords:
            where_clause = ' WHERE ekatte.name ~ %s OR provinces.name ~ %s OR municipalities.name ~ %s'
            query += where_clause
            pattern = "(" + "|".join(search_keywords) + ")"
            exc_query = cursor.mogrify(query, [pattern, pattern, pattern])
        else:
            exc_query = cursor.mogrify(query)
        cursor.execute(exc_query)
        rows = (FullEkatte(*row) for row in cursor.fetchall())
        return FullEkatte._fields, rows
