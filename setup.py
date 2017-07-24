# -*- coding: utf-8 -*-
"""
documentation
"""

from setuptools import setup, find_packages
import os
import sys
sys.path.insert(0, '.')

import mycelyso_inspector


def get_all_files(path):
    result = []
    path_basename = os.path.basename(path)
    for long_root, dirs, files in os.walk(path):
        root = long_root[(len(path) - len(path_basename)):]
        for file in files:
            result.append(os.path.join(root, file))
    return result

ADDITIONAL_STATIC_FILES = get_all_files('mycelyso_inspector/static')

if ((len([filename for filename in ADDITIONAL_STATIC_FILES if '/bower_components/' in filename]) == 0) and
        not ('SKIP_BOWER_CHECK' in os.environ and os.environ['SKIP_BOWER_CHECK'] == '1')):
    print("This package needs various bower (a JavaScript/web dependency manager) packages to work properly.")
    print("They were not found. Please run `bower install` in mycelyso_inspector/static before packaging.")
    raise SystemExit

BLACKLIST = [
    'node_modules', '/less/', 'mathbox/vendor', 'mathbox/release', 'cytoscape/benchmark', 'cytoscape/snippets'
]

for item in BLACKLIST:
    ADDITIONAL_STATIC_FILES = [filepath for filepath in ADDITIONAL_STATIC_FILES if item not in filepath]

ADDITIONAL_STATIC_FILES = [filepath for filepath in ADDITIONAL_STATIC_FILES if not os.path.isdir(filepath)]

setup(
    name='mycelyso-inspector',
    version=mycelyso_inspector.__version__,
    description='MYCElium anaLYsis SOftware - Inspector',
    long_description='see https://github.com/modsim/mycelyso',
    author=mycelyso_inspector.__author__,
    author_email='c.sachs@fz-juelich.de',
    url='https://github.com/modsim/mycelyso',
    packages=find_packages(),
    install_requires=['numpy', 'scipy', 'matplotlib', 'mpld3', 'pandas', 'flask', 'networkx', 'purepng'],
    package_data={
        'mycelyso_inspector': ADDITIONAL_STATIC_FILES
    },
    license='BSD',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Console',
        'Intended Audience :: Science/Research',
        'License :: OSI Approved :: BSD License',
        'Operating System :: POSIX',
        'Operating System :: POSIX :: Linux',
        'Operating System :: MacOS :: MacOS X',
        'Operating System :: Microsoft :: Windows',
        'Programming Language :: Python :: 3',
        'Programming Language :: Python :: 3.4',
        'Programming Language :: Python :: 3.5',
        'Topic :: Scientific/Engineering :: Bio-Informatics',
        'Topic :: Scientific/Engineering :: Image Recognition',
    ]
)
