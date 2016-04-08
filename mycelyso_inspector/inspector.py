# -*- coding: utf-8 -*-
"""
documentation
"""

import sys
import os
import glob

import numpy
import matplotlib
matplotlib.use('Agg')
from matplotlib import pyplot
import mpld3
import cv2
import pandas

from flask import Flask, Blueprint, redirect, jsonify, abort, g, send_file, Response
from argparse import ArgumentParser



bp = Blueprint('inspector', __name__)


def h5_join(*args):
    return '/'.join(args)

h5_base_node = '/results'

h5_directory = os.getcwd()
h5_extension = '*.h5'
h5_files = {}

open_files = {}


def update_files():
    current_files = list(glob.glob(os.path.join(h5_directory, h5_extension)))
    h5_files.clear()
    for name in current_files:
        h5_files[os.path.basename(name)] = name


@bp.route('/')
def hello():
    return redirect('static/index.htm')

@bp.route('/mpld3.js')
def send_mpld3():
    return send_file(mpld3.urls.MPLD3_LOCAL)


@bp.route('/files/index.json')
def get_files():
    update_files()
    return jsonify(files=list(h5_files.keys()))


@bp.url_value_preprocessor
def open_file_if_present(endpoint, values):
    if 'file_name' in values:
        g.file_name = file_name = values.pop('file_name', None)
        if file_name not in open_files:
            update_files()
            if file_name not in h5_files:
                abort()

            open_files[file_name] = pandas.HDFStore(h5_files[file_name], 'r')

        g.h = open_files[file_name]
        g.h5h = g.h._handle


@bp.url_value_preprocessor
def parse_h5_path_if_present(endpoint, values):
    if 'original_name' in values and 'position_name' in values:
        g.original_name = values.pop('original_name', None)
        g.position_name = values.pop('position_name', None)
        g.h5_path = h5_join(h5_base_node, g.original_name, g.position_name)


@bp.route('/files/<file_name>/index.json')
def get_file_contents():
    result = {}

    for node in g.h5h.list_nodes(where=h5_base_node):
        original_name = node._v_name
        positions = []
        for position in g.h5h.list_nodes(where=h5_join(h5_base_node, original_name)):
            position_name = position._v_name
            positions.append(position_name)

        result[original_name] = positions

    return jsonify(contents=result)


POSITION_PREFIX = '/files/<file_name>/data/<original_name>/<position_name>/'

try:
    from pilyso.imagestack.imagestack import ImageStack, Dimensions, MinMaxFilter
    # ditch these # TODO
    import pilyso.imagestack.tiffimagestack
    import pilyso.imagestack.ometiffimagestack
    import pilyso.imagestack.nd2imagestack
    # /
except ImportError:
    ImageStack = Dimensions = MinMaxFilter = None

images_in_collage = 3
images_subsampling = 4
perform_non_linear_adaption = True
minimum_percentage, maximum_percentage = 0.0, 0.5

imagestacks = {}

@bp.route(POSITION_PREFIX + 'original_snapshot.jpg')
def original_snapshot():
    if ImageStack is None:
        image = numpy.zeros((32, 32), dtype=numpy.uint8)
    else:
        inject_tables()
        path = str(g.RT.filename_complete[0])

        if path not in imagestacks:
            imagestacks[path] = ImageStack(path).filter(MinMaxFilter)

        ims = imagestacks[path]
        ims = ims.view(Dimensions.Position, Dimensions.Time)[int(g.RT.meta_pos[0]), :]

        timepoints = ims.sizes[0]


        images = [ims[i] for i in range(0, timepoints, timepoints//images_in_collage)]
        images = [i[::images_subsampling, ::images_subsampling] for i in images]


        if perform_non_linear_adaption:
            for im in images:
                im -= im.min()
                im /= im.max()

                numpy.clip(im, minimum_percentage, maximum_percentage, out=im)

                im -= im.min()
                im /= im.max()


        images = [(i*255).astype(numpy.uint8) for i in images]


        image = numpy.concatenate(images, axis=1)

        # old code ...
        # namelet = g.original_name.split('_')[-2]
        # num = int(g.position_name.split('_')[1])
        # image_file = h5_directory + "/tmp/%s.nd2_%04d.jpg" % (namelet, num,)
        # # send_file

    return Response(to_jpg(image), mimetype='image/jpeg')


def inject_tables():
    g.RT = g.h[h5_join(g.h5_path, 'result_table')]
    g.RTC = g.h[h5_join(g.h5_path, 'result_table_collected')]
    g.TT = g.h[h5_join(g.h5_path, 'tables', 'track_table', 'track_table_000000000')]


def dataframe_to_json_safe_array_of_dicts(df):
    # JSON doesn't like NaN
    # which is horrible utter bulls*
    # but I'm not in the mood to monkey patch JSON around now ...

    def safe_cast(value):
        if isinstance(value, type("")):
            return value
        if numpy.isfinite(value):
            return numpy.asscalar(value)
        return None

    c = list(df.columns)

    return [
        dict(zip(c, map(safe_cast, row))) for row in df.itertuples(False)
    ]


@bp.route(POSITION_PREFIX + 'results.json')
def results_per_position():
    inject_tables()

    return jsonify(results=dataframe_to_json_safe_array_of_dicts(g.RT)[0])

def to_image(image, ext):
    return cv2.imencode('.%s' % ext, image)[1].tobytes()

def to_jpg(image):
    return to_image(image, 'jpg')

def to_png(image):
    return to_image(image, 'png')

def get_images_by_request_and_path(n=1, *args):
    return numpy.concatenate([
                numpy.array(i) for i in list(g.h5h.get_node(h5_join(*((g.h5_path,) + args))))[::n]
            ], axis=1).astype(numpy.uint8)


@bp.route(POSITION_PREFIX + 'skeleton_<int:n>.png')
def get_skeletons(n=1):
    return Response(to_png(~get_images_by_request_and_path(n, 'images', 'skeleton')), mimetype='image/png')


@bp.route(POSITION_PREFIX + 'binary_<int:n>.png')
def get_binary(n=1):
    return Response(to_png(~get_images_by_request_and_path(n, 'images', 'binary')), mimetype='image/png')

seconds_to_hours = (1 / (60.0*60.0))
um_per_s_to_um_per_h = 60.0 * 60.0


class Plots(object):

    @staticmethod
    def tracked_segments(fig):
        pyplot.title('Tracked Segments')
        pyplot.xlabel('time [h]')
        pyplot.ylabel('elongation rate [µm∙h⁻¹]')
        # pyplot.plot(g.RTC.timepoint * seconds_to_hours, g.RTC.covered_area)
        pyplot.hlines(g.TT.plain_regression_slope * um_per_s_to_um_per_h,
                      xmin=g.TT.timepoint_begin * seconds_to_hours,
                      xmax=g.TT.timepoint_end * seconds_to_hours)

    @staticmethod
    def covered_area(fig):
        pyplot.title('Covered Area')
        pyplot.xlabel('time [h]')
        pyplot.ylabel('covered area [µm²]')
        pyplot.plot(g.RTC.timepoint * seconds_to_hours, g.RTC.covered_area)

    @staticmethod
    def graph_edge_length(fig):
        pyplot.title('Edge Length of Graph')
        pyplot.xlabel('time [h]')
        pyplot.ylabel('edge length [µm]')
        pyplot.plot(g.RTC.timepoint * seconds_to_hours, g.RTC.graph_edge_length)

    @staticmethod
    def graph_node_count(fig):
        pyplot.title('Node Count of Graph')
        pyplot.xlabel('time [h]')
        pyplot.ylabel('node count [#]')
        pyplot.plot(g.RTC.timepoint * seconds_to_hours, g.RTC.graph_node_count)

    @staticmethod
    def graph_branchness(fig):
        pyplot.title('(Edge Length/Intersection Count) of Graph')
        pyplot.xlabel('time [h]')
        pyplot.ylabel('µm⁻¹')
        x = numpy.array(g.RTC.timepoint) * seconds_to_hours
        y = numpy.array(g.RTC.graph_edge_length) / numpy.array(g.RTC.graph_junction_count)

        x = x[numpy.isfinite(y)]
        y = y[numpy.isfinite(y)]
        pyplot.plot(x, y)


@bp.route(POSITION_PREFIX + 'plots/<plot_name>.json')
def get_plot(plot_name):

    if plot_name == 'index':
        return jsonify(plots=[
            [" ".join([x.capitalize() for x in name.split('_')]), "plots/%s.json" % (name,)]
            for name in dir(Plots) if name[0] != '_'])

    if plot_name[0] == '_':
        abort(404)

    inject_tables()

    to_call = getattr(Plots, plot_name, None)
    if to_call is None:
        abort(404)

    fig = pyplot.figure()
    to_call(fig)

    result = mpld3.fig_to_dict(fig)

    pyplot.close('all')

    return jsonify(result)


@bp.route(POSITION_PREFIX + 'track_plots/<number>.json')
def get_track_plot(number):

    inject_tables()
    mapping = g.h[h5_join(g.h5_path, 'tables', '_mapping_track_table_aux_tables', 'track_table_aux_tables_000000000')]
    tables = {int(index): int(row.individual_table) for index, row in mapping.iterrows()}

    if number == 'index':
        return jsonify(plots=[["Track %04d" % (num,), "track_plots/%d.json" % (num,)] for num in sorted(tables.keys())])

    number = int(number)

    if number not in tables:
        abort(404)

    pad_zeros = len('000000001')

    table = g.h[h5_join(g.h5_path, 'tables', '_individual_track_table_aux_tables',
                        'track_table_aux_tables_' + (('%0' + str(pad_zeros) + 'd') % (tables[number],)))]

    fig = pyplot.figure()
    pyplot.title('Track #%d' % (number,))
    pyplot.xlabel('time [h]')
    pyplot.ylabel('distance [µm]')
    pyplot.plot(table.timepoint * seconds_to_hours, table.distance, marker='.')

    result = mpld3.fig_to_dict(fig)

    pyplot.close('all')

    return jsonify(result)


@bp.route(POSITION_PREFIX + 'graphs/<number>.json')
def get_graph(number):
    import networkx as nx
    inject_tables()

    # if number == 'index':
    #     return jsonify(plots=[
    #         ["Track %04d" % (num,), "track_plots/%d.json" % (num,)]
    #         for num in sorted(tables.keys())])

    number = int(number)
    pad_zeros = len('000000001')

    graphml_data = numpy.array(g.h5h.get_node(h5_join(g.h5_path, 'data', 'graphml',
                                                      'graphml_' + (('%0' + str(pad_zeros) + 'd') % (number,))))
                               ).tobytes()

    reader = nx.GraphMLReader()
    graph = next(iter(reader(string=graphml_data)))

    cytoscape_json = {
        "nodes": [
            {"data": {"id": int(node_id)}, "position": {"x": attr['x'], "y": attr['y']}}
            for node_id, attr in graph.node.items()
        ],
        "edges":
            list({
                     (min(int(node_a_id), int(node_b_id)), max(int(node_a_id), int(node_b_id))):
                     {"data": {"source": int(node_a_id), "target": int(node_b_id), "weight": attr['weight']}}
                     for node_a_id, more in graph.edge.items()
                     for node_b_id, attr in more.items() if node_a_id != node_b_id
                 }.values())


    }
    return jsonify(cytoscape_json)


@bp.route(POSITION_PREFIX + 'tracks/<number>.json')
def get_track(number):

    inject_tables()
    mapping = g.h[h5_join(g.h5_path, 'tables', '_mapping_track_table_aux_tables', 'track_table_aux_tables_000000000')]
    tables = {int(index): int(row.individual_table) for index, row in mapping.iterrows()}

    if number == 'index':
        return jsonify(tracks=[num for num in sorted(tables.keys())])

    number = int(number)

    if number not in tables:
        abort(404)

    pad_zeros = len('000000001')

    table = g.h[h5_join(g.h5_path, 'tables', '_individual_track_table_aux_tables',
                        'track_table_aux_tables_' + (('%0' + str(pad_zeros) + 'd') % (tables[number],)))]

    subsets = {t: g.RTC.query('timepoint == @t') for t in numpy.array(table.timepoint)}
    table['meta_t'] = table.timepoint.map(lambda t: numpy.array(subsets[t].meta_t)[0])
    table['graph'] = table.timepoint.map(lambda t: numpy.array(subsets[t].graphml)[0])
    return jsonify(results=dataframe_to_json_safe_array_of_dicts(table))


@bp.route(POSITION_PREFIX + 'tracking.json')
def get_tracking():

    inject_tables()

    return jsonify(results=dataframe_to_json_safe_array_of_dicts(g.TT))



def main():
    app = Flask(__name__)
    app.register_blueprint(bp)

    argparser = ArgumentParser(description="mycelyso inspector")

    def _error(message=''):
        argparser.print_help()
        print("command line argument error: %s" % message)
        sys.exit(1)

    argparser.error = _error

    argparser.add_argument('-p', '--port', dest='port', type=int, default=5000)
    argparser.add_argument('-b', '--bind', dest='host', type=str, default='0.0.0.0')
    argparser.add_argument('-P', '--processes', dest='processes', type=int, default=8)
    argparser.add_argument('-d', '--debug', dest='debug', default=False, action='store_true')

    args = argparser.parse_args()

    if args.debug:
        args.host = '127.0.0.1'
        print("Debug mode enabled, host force-set to %s" % args.host)
        app.debug = True

        app.run(host=args.host, port=args.port)
    else:

        @app.errorhandler(500)
        def internal_error(exception):
            print(exception)
            return Response('Error', 500)


        app.run(host=args.host, port=args.port, processes=args.processes)



if __name__ == '__main__':
    main()

