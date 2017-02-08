'use strict';

var getRemarks, putRemarks, getCurrent, putCurrent;

if(window.localStorage) {
    getRemarks = function() {
        if(localStorage['remarks']) {
            return JSON.parse(localStorage['remarks']);
        }
        return {};
    };

    putRemarks = function(remarks) {
        localStorage['remarks'] = JSON.stringify(remarks);
    };

    getCurrent = function() {
        if(localStorage['strepto_current'])
            return localStorage['strepto_current'];
        else
            return null;
    };

    putCurrent = function(pos) {
        localStorage['strepto_current'] = pos;
    };

} else {
    getRemarks = function() {
        return {};
    };

    putRemarks = function(remarks) {
    };

    getCurrent = function() {
        return null;
    };

    putCurrent = function(pos) {

    };
}

var PREFIX = '';

function make_url() {
    var arr = [];
    for(var i=0; i < arguments.length; i++)
        arr.push(arguments[i]);

    return arr.join('/');
}

var streptoApp = angular.module('streptoApp', ['ui.slider', 'ui.grid', 'ui.grid.selection', 'ui.grid.moveColumns', 'ui.grid.exporter']);


streptoApp.controller('streptoPositionManagement', function($scope, $http, $rootScope) {
    $scope.files = [];
    $scope.fileIndex = {};

   $scope.broadcastPosition = function() {
        putCurrent(serialize());
        $rootScope.$emit('newPositionUrl', make_url(PREFIX, 'files', $scope.file, 'data', $scope.data_file, $scope.position));
    };

    $scope.prettifyNumber = function(val) {
        return Number(val.split('_')[1]);
    };

    $scope.loadFileIndex = function(f) {
        $http.get(make_url(PREFIX, 'files', $scope.file, 'index.json')).success(function(response) {
            $scope.fileIndex = response.contents;

            if(!$scope.data_file) {
                $scope.data_file = Object.keys($scope.fileIndex)[0];
                $scope.position = $scope.fileIndex[$scope.data_file][0];
                $scope.broadcastPosition()
            }
        });
    };

    $http.get(make_url(PREFIX, 'files', 'index.json')).success(function(response) {
        $scope.files = response.files;

        if(!$scope.file) {
            $scope.file = $scope.files[0];
            $scope.loadFileIndex($scope.file);
        }

    });

    $scope.previousPosition = function() {
      $scope.position = $scope.fileIndex[$scope.data_file][(($scope.fileIndex[$scope.data_file].indexOf($scope.position) == 0) ? (0) : ($scope.fileIndex[$scope.data_file].indexOf($scope.position) - 1))];
      $scope.broadcastPosition();
    };

    $scope.nextPosition = function() {
      $scope.position = $scope.fileIndex[$scope.data_file][(($scope.fileIndex[$scope.data_file].indexOf($scope.position) == ($scope.fileIndex[$scope.data_file].length - 1)) ? ($scope.fileIndex[$scope.data_file].indexOf($scope.position)) : ($scope.fileIndex[$scope.data_file].indexOf($scope.position) + 1))];
      $scope.broadcastPosition();
    };

    $(document).keydown(function(e) {
        if(e.which == 37)
            $scope.previousPosition();
        else if(e.which == 39)
            $scope.nextPosition();
    });


    function deserialize(s) {
        s = s.split(',');

        if(s.length > 0) {
            $scope.file = s[0];
            $scope.loadFileIndex($scope.file);
        }

        if(s.length > 1)
            $scope.data_file = s[1];

        if(s.length > 2) {
            $scope.position = s[2];
        }
    }

    function serialize() {
        return $scope.file + ',' + $scope.data_file + ',' + $scope.position;
    }


    if(window.location.hash.length > 0) {
        deserialize(window.location.hash.substr(1));
        putCurrent(serialize());
    }

    if(getCurrent()) {
        deserialize(getCurrent());
        $scope.broadcastPosition();
    }

    $rootScope.$on('requestPosition', function(event, url) {
        $scope.broadcastPosition();
    });
});




streptoApp.controller('streptoUrlAndIntervalController', function($scope, $http, $rootScope) {
    $scope.url = '';

    $rootScope.$on('newPositionUrl', function(event, url) {
        $scope.url = url;
    });

    $scope.n = 8;
    $scope.what = 'binary';

    $rootScope.$emit('requestPosition');
});


streptoApp.controller('streptoResultGrid', function($scope, $http, $rootScope) {

    function beautify(s) {
        return s.split('_').map(function(x) { return x.substring(0, 1).toUpperCase() + x.substr(1);} ).join(' ');
    }

    $scope.grid = {
        data: [],
        columnDefs: [
            {name: "Key", width: 500},
            {name: "Value", width: 200}
        ]
    };

    $scope.url = '';

    $scope.remark_array = getRemarks();

    $scope.remarks = '';

    $scope.store = function() {
        if($scope.url == '')
            return;
        if($scope.remarks != '') {
            $scope.remark_array[$scope.url] = {
                filename: $scope.results.filename,
                position: $scope.results.meta_pos,
                meta: $scope.results.metadata,
                remark: $scope.remarks
            };

            putRemarks($scope.remark_array);
        } else {
            if($scope.remark_array[$scope.url]) {
                delete $scope.remark_array[$scope.url];
            }
        }
    };

    $scope.getAll = function() {
        $scope.store();
        var order = ['filename', 'position', 'meta', 'remark'];

        var str = "";
        str += order.join("\t") + "\n";
        for(var k in $scope.remark_array) {
            str += order.map(function(x) { return $scope.remark_array[k][x]; }).join("\t") + "\n";
        }

        window.prompt("Copy this with Ctrl-C and insert into a spreadsheet program", str);

    };

    $rootScope.$on('newPositionUrl', function(event, url) {
        $scope.store();
        $scope.remarks = '';

        $scope.url = url;

        if($scope.remark_array[$scope.url])
            $scope.remarks = $scope.remark_array[$scope.url].remark;


        $http.get(make_url(url, 'results.json')).success(function(response) {
            $scope.results = response.results;

            $scope.grid.data = [];

            for(var n in $scope.results) {
                $scope.grid.data.push({
                    "Key": beautify(n),
                    "Value": $scope.results[n]
                });
            }

            if($scope.remark_array[url]) {
                $scope.remarks = $scope.remark_array[url].remark;
            }
        });
    });


});


streptoApp.controller('streptoTrackingGrid', function($scope, $http, $rootScope, uiGridConstants) {
    $scope.gridApi = null;
    $scope.grid = {
        enableGridMenu: true,
        enableFiltering: true,
        enableRowSelection: true,
        enableRowHeaderSelection: false,
        multiSelect: false,
        modifierKeysToMultiSelect: false,
        onRegisterApi: function(gridApi) {
            $scope.gridApi = gridApi;
            $scope.gridApi.selection.on.rowSelectionChanged($scope, function(row) {
                $rootScope.$emit('selectTrackPlot', row.entity.aux_table);
            });
        }
    };

    $rootScope.$on('newPositionUrl', function(event, url) {

        $http.get(make_url(url, 'tracking.json')).success(function(response) {

            var columns = [];
            for(var name in response.results[0]) {
                columns.push(name);
            }

            $scope.grid.data = response.results;
            $scope.grid.columnDefs = columns.map(function(name) {
                return {
                    name: name,
                    width: 400,
                    filters: [
                    {
                        condition: uiGridConstants.filter.GREATER_THAN,
                        placeholder: '>'
                    },
                    {
                        condition: uiGridConstants.filter.LESS_THAN,
                        placeholder: '<'
                    }]
                }
            });
        });
    });
});


streptoApp.controller('streptoPlotlist', function($scope, $http, $rootScope, $q) {

    $scope.plotIndex = 0;
    $scope.plots = [];

    // gets overridden later
    $scope.showPlot = function() {};


    $rootScope.$on('newPositionUrl', function(event, url) {
        $q.all([
            $http.get(make_url(url, 'plots', 'index' + '.json')),
            $http.get(make_url(url, 'track_plots', 'index' + '.json'))
        ]).then(function(responses) {
            $scope.plots = [];
            $scope.plots = $scope.plots.concat(responses[0].data.plots);
            $scope.plots = $scope.plots.concat(responses[1].data.plots);

            $scope.showPlot = function() {
                if(($scope.plots.length - 1) > $scope.plotIndex)
                $rootScope.$emit('showPlot', url + '/' + $scope.plots[$scope.plotIndex][1])
            };

            $scope.showPlot();
        });
    });

    $rootScope.$on('selectTrackPlot', function(event, plotNum) {
        for(var i = 0; i < $scope.plots.length; i++) {
            var thisNum = Number($scope.plots[i][0].split(' ')[1]);
            if(plotNum == thisNum) {
                $scope.plotIndex = i;
                $scope.showPlot();
                break;
            }
        }
    });
});


streptoApp.controller('streptoPlotwidget', function($scope, $http, $rootScope) {
    $rootScope.$on('showPlot', function(event, url) {
        var element = document.getElementById('plot');

        while(element.children.length > 0)
            element.removeChild(element.children[0]);

        $http.get(url).success(function(response) {
            mpld3.draw_figure('plot', response);
        });
    });
});



streptoApp.controller('streptoGraph', function($scope, $http, $rootScope, $q) {

    $scope.url = '';

    $rootScope.$on('newPositionUrl', function(event, url) {
        $scope.url = url;
        $('#graphContainer').html('');
    });

    $rootScope.$on('selectTrackPlot', function(event, trackNum) {
        $scope.trackNum = trackNum;
        $('#graphContainer').html('');
    });

    $scope.getGraphsForTrack = function() {
        $('#graphContainer').html('');
        $http.get(make_url($scope.url, 'tracks', $scope.trackNum + '.json')).then(function(response) {
            var track = response.data.results;


            $q.all(track.map(function(t) { return $http.get(make_url($scope.url, 'graphs', t.graph + '.json')); }))
            .then(function(responses) {

                $('#graphContainer').html('');

                for(var i = 0; i < track.length; i++) {
                    if(track[i] === undefined)
                        continue; //strange?
                    var graphData = responses[i].data;

                    var target = $('<div/>', { id: 'graph' + i  }).appendTo('#graphContainer');

                    var cy = cytoscape({
                        container: target,
                        elements: graphData,
                        layout: {
                            name: 'preset'
                        },
                        style: cytoscape.stylesheet()
                            .selector('node')
                                .css({
                                    'width': 10,
                                    'height': 10
                                })
                            .selector('edge')
                                .css({
                                    'width': 'mapData(weight, 10, 10000, 1, 10)',
                                    'content': function(el) { return el.data().weight.toFixed(0) + ' µm'; }
                                })
                            .selector('.marked')
                                .css({
                                    'line-color': 'red'
                                })
                    });

                    target.prepend('<span style="font-weight: bold;">Graph t=' + track[i].meta_t + ' / ' + (track[i].timepoint / (60.0*60.0)).toFixed(2) + 'h Distance = ' + (track[i].distance).toFixed(2) + ' µm</span><br />');

                    cy.autolock(true);

                    var dij = cy.elements().dijkstra('#' + track[i].node_id_a, function() {
                        return this.data('weight');
                    });

                    var path = dij.pathTo(cy.$('#' + track[i].node_id_b));

                    //cy.edges('[source="' + track[i].node_id_a + '"][target="' + track[i].node_id_b + '"],[source="' + track[i].node_id_b + '"][target="' + track[i].node_id_a + '"]').addClass('marked');

                    path.edges().addClass('marked');
                }
            });

        });
    };
});
