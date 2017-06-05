import os
import sys
import json
import random
import urllib.request

from argparse import ArgumentParser
from multiprocessing import Pool
from .. import __banner__

try:
    import tqdm
except ImportError:
    tqdm = None


def progress(iterable_, total=None):
    if tqdm:
        for item in tqdm.tqdm(iterable_, total=total):
            yield item
    else:
        if total is None:
            total = len(iterable_)
        for n, item in enumerate(iterable_):
            print("\r%d/%d" % (n, total), end="\r")
            yield item


def get_file(url):
    with urllib.request.urlopen(url) as response:
        return response.read()


def get_json(url):
    return json.loads(get_file(url).decode())


def download_url_to_file(url_file_name):
    url, file_name = url_file_name
    with open(file_name, 'wb+') as fp:
        fp.write(get_file(url))


def main():
    print(__banner__)

    argparser = ArgumentParser(description="mycelyso Inspector Fetcher")

    def _error(message=''):
        argparser.print_help()
        print("command line argument error: %s" % message)
        sys.exit(1)

    argparser.error = _error

    argparser.add_argument('url', type=str, nargs=1)
    argparser.add_argument('-o', '--output-dir', dest='output_dir', type=str, default='.')
    argparser.add_argument('-w', '--overwrite', dest='overwrite', default=False, action='store_true')

    args = argparser.parse_args()

    args.url = args.url[0]

    if args.url[-1] == '/':
        args.url = args.url[:-1]

    urls = []

    index_fragment = '/files/index.json'
    urls.append(index_fragment)

    for file_name in get_json(args.url + index_fragment)['files']:
        file_name_content_url = '/files/%s/index.json' % (file_name,)
        urls.append(file_name_content_url)
        for original_name, positions in get_json(args.url + file_name_content_url)['contents'].items():
            for position in positions:
                prefix = '/files/%s/data/%s/%s/' % (file_name, original_name, position,)
                for urllet in get_json(args.url + prefix + 'urls.json')['urls']:
                    urls.append(prefix + urllet)

    urls += get_json(args.url + '/static-urls.json')['urls']

    # the first half takes very long, the second is rather fast
    # shuffle it so ETA estimations make more sense
    random.shuffle(urls)

    todo_list = []

    for url in progress(urls):
        filename = url[1:]
        pathlet = os.path.dirname(filename)
        absolute_directory = os.path.abspath(os.path.join(args.output_dir, pathlet))
        os.makedirs(absolute_directory, exist_ok=True)

        absolute_file = os.path.abspath(os.path.join(args.output_dir, filename))

        if os.path.isfile(absolute_file) and not args.overwrite:
            raise RuntimeError("Output %s already exists!" % (absolute_file,))

        todo_list.append((args.url + url, absolute_file))

    pool = Pool()

    for _ in progress(pool.imap_unordered(download_url_to_file, todo_list), total=len(todo_list)):
        pass

    print("Done")


if __name__ == '__main__':
    main()
