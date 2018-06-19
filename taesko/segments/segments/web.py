import collections

import flask
import segments.segments as segments

app = flask.Flask(__name__)


@app.route('/')
def index():
    get_params = collections.OrderedDict(
        [('line_length', "Line length"),
         ('a_step', "Step of A->B"),
         ('b_step', "Step of B->A"),
         ('segment_length', "Segment length")])
    if all(p in flask.request.args for p in get_params):
        try:
            sol_params = {p:int(flask.request.args[p]) for p in get_params}
        except TypeError:
            return flask.render_template('base.html', get_params=get_params)
        red_segs = segments.all_red_segments(**sol_params)
        result = segments.solve(**sol_params)
        return flask.render_template('solution.html',
                                     get_params=get_params,
                                     line_length=sol_params['line_length'],
                                     red_segments=red_segs,
                                     solution=result)
    else:
        return flask.render_template('base.html', get_params=get_params)
