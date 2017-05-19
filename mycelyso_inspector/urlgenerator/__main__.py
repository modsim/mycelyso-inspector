import os
import sys
import glob
import json
import urllib3

http = urllib3.PoolManager()


def get_json(url):
    return json.loads(http.request('GET', url).data.decode())


def main():
    base = sys.argv[1]
    if base[-1] == '/':
        base = base[:-1]

    urls = []

    index_fragment = '/files/index.json'
    urls.append(index_fragment)
    for file_name in get_json(base + index_fragment)['files']:
        file_name_content_url = '/files/%s/index.json' % (file_name,)
        urls.append(file_name_content_url)
        for original_name, positions in get_json(base + file_name_content_url)['contents'].items():
            for position in positions:
                prefix = '/files/%s/data/%s/%s/' % (file_name, original_name, position,)
                for urllet in get_json(base + prefix + 'urls.json')['urls']:
                    urls.append(prefix + urllet)

    urls.append('/mpld3.js')

    the_dir = os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir)), 'static')

    for path_name in glob.glob('%s/**' % (the_dir,), recursive=True):
        if os.path.isdir(path_name):
            continue
        path_name = path_name.replace(the_dir, '')

        urls.append('/static' + path_name)

    for n, url in enumerate(urls):
        print("echo Retrieving %d/%d ..." % (n + 1, len(urls),))
        print("curl %s%s --create-dirs -o %s" % (base, url, url[1:],))


if __name__ == '__main__':
    main()