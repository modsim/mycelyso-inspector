# -*- coding: utf-8 -*-
"""
documentation
"""

from setuptools import setup, find_packages
import os


def get_all_files(path):
    result = []
    path_basename = os.path.basename(path)
    for long_root, dirs, files in os.walk(path):
        root = long_root[(len(path) - len(path_basename)):]
        for file in files:
            result.append(os.path.join(root, file))
    return result

setup(
    name='mycelyso_inspector',
    version='0.0.1',
    description='MYCElium anaLYsis SOftware - Inspector',
    long_description='',
    author='Christian C. Sachs',
    author_email='c.sachs@fz-juelich.de',
    url='https://github.com/modsim/mycelyso',
    packages=['mycelyso_inspector'],
    #scripts=[''],
    install_requires=['numpy', 'scipy', 'matplotlib', 'mpld3', 'pandas', 'flask', 'networkx', 'purepng'],
    # extras_require={
    #     'feature': ['package'],
    # },
    package_data={
        'mycelyso_inspector': get_all_files('mycelyso_inspector/static')
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
