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
        if(localStorage['mycelyso_current'])
            return localStorage['mycelyso_current'];
        else
            return null;
    };

    putCurrent = function(pos) {
        localStorage['mycelyso_current'] = pos;
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

var mycelysoApp = angular.module('mycelysoApp', ['ui.slider', 'ui.grid', 'ui.grid.selection', 'ui.grid.moveColumns', 'ui.grid.exporter']);


mycelysoApp.controller('mycelysoPositionManagement', function($scope, $http, $rootScope) {
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




mycelysoApp.controller('mycelysoUrlAndIntervalController', function($scope, $http, $rootScope) {
    $scope.url = '';

    $rootScope.$on('newPositionUrl', function(event, url) {
        $scope.url = url;
    });

    $scope.n = 8;
    $scope.what = 'binary';

    $rootScope.$emit('requestPosition');
});


mycelysoApp.controller('mycelysoResultGrid', function($scope, $http, $rootScope) {

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


mycelysoApp.controller('mycelysoTrackingGrid', function($scope, $http, $rootScope, uiGridConstants) {
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


mycelysoApp.controller('mycelysoPlotlist', function($scope, $http, $rootScope, $q) {

    $scope.url = '';

    $scope.plotIndex = 0;
    $scope.plots = [];

    // gets overridden later
    $scope.showPlot = function() {};


    $rootScope.$on('newPositionUrl', function(event, url) {
        $scope.url = url;

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


mycelysoApp.controller('mycelysoPlotwidget', function($scope, $http, $rootScope) {
    $rootScope.$on('showPlot', function(event, url) {
        $http.get(url).success(function(response) {
            $('#plot').html('');
            mpld3.draw_figure('plot', response);
        });
    });
});



mycelysoApp.controller('mycelysoGraph', function($scope, $http, $rootScope, $q) {

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
                    var graphData = responses[i].data[track[i].graph];

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

mycelysoApp.controller('mycelyso3DVis', function($scope, $http, $rootScope, $q) {

    $scope.url = '';

    $rootScope.$on('newPositionUrl', function(event, url) {
        $scope.url = url;
        $('#graphContainer').html('');
    });

    $scope.vis = function() {
        var mathbox = mathBox({
            element: document.getElementById('visualizationContainer'),
            plugins: ['core', 'cursor', 'controls'],
            controls: {
                //klass: THREE.TrackballControls
                klass: THREE.OrbitControls
            }
        });

        var three = mathbox.three;
        three.renderer.setClearColor(new THREE.Color(0xffffff), 1.0);

        var maxAniso = three.renderer.getMaxAnisotropy();

        mathbox.set({scale: 720, focus: 3});
        mathbox.camera({proxy: true, position: [1, 1, 1]});


        $q.all([$http.get(make_url($scope.url, 'visualization', 'complete.json'))])
        .then(function(responses) {
           var response_data = responses[0].data;

           var minVector = new THREE.Vector3().fromArray(response_data.minVector),
               maxVector = new THREE.Vector3().fromArray(response_data.maxVector);

           var nodes = [],
               edges = [],
               edgeLabels = [],
               edgeLabelPositions = [];

           for(var gid in response_data.graphs) {
               var graph = response_data.graphs[gid];

               for(var nid in graph.nodes) {
                   nodes.push(graph.nodes[nid]);
               }

               for(var eid = 0; eid < graph.edges.length; eid++) {
                   var edge = graph.edges[eid];
                   var label = graph.edgeLabels[eid];

                   var a = graph.nodes[edge[0]],
                       b = graph.nodes[edge[1]];

                   edges.push(a, b);

                   edgeLabelPositions.push(
                       (new THREE.Vector3().fromArray(a)).sub(
                           new THREE.Vector3().fromArray(b)
                       ).divideScalar(2.0).add(
                           new THREE.Vector3().fromArray(b)
                       ).toArray()
                   );

                   edgeLabels.push(graph.edgeLabels[eid]);
               }
           }


           var timeToPixel = 50.0;

            var view = mathbox.cartesian({
                range: [[minVector.x, maxVector.x], [minVector.y, maxVector.y], [minVector.z, maxVector.z]],
                scale: [
                    1.0,
                    timeToPixel*((maxVector.y-minVector.y)/(maxVector.x-minVector.x)),
                    (maxVector.z-minVector.z)/(maxVector.x-minVector.x)
                ]
            });



            view.axis({axis: 1});
            view.axis({axis: 2});
            view.axis({axis: 3});

            /*
            view.array({
                'id': 'nodesLookup',
                width: nodes.length,
                items: 1,
                channels: 3,
                live: false,
                data: nodes
            }).point({
                color: 'gray',
                size: 10,
                zOrder: 2
            });
            */
            console.log(edges.length);

            view.array({
                'id': 'edges',
                width: edges.length,
                items: 2,
                channels: 3,
                live: false,
                data: edges
            }).vector({
                color: 'lightgray',
                size: 10,
                zOrder: 1
            });

            console.log("***");

            var viewLabel = false;
            if(viewLabel) {
                view.array({
                    id: 'edgeLabels',
                    width: edgeLabelPositions.length,
                    items: 1,
                    channels: 3,
                    live: false,
                    data: edgeLabelPositions
                }).format({
                    data: edgeLabels
                }).label({
                    id: 'edgeLabelsLabels',
                    color: '#00ff0000',
                    size: 10,
                    zIndex: -1,
                    visible: false
                });
            }


            // some more niceties

            view.grid({
                axes: "xz",
                divideX: 10,
                divideY: 10 * (maxVector.z-minVector.z)/(maxVector.x-minVector.x)
            });

            view.scale({
                axis: "x",
                divide: 5
            }).ticks({
                width: 2.5,
                zBias: 1
            }).format().label({
                size: 16,
                depth: 1
            });

            view.scale({
                axis: "z",
                divide: 5 * (maxVector.z-minVector.z)/(maxVector.x-minVector.x)
            }).ticks({
                width: 2.5,
                zBias: 1
            }).format().label({
                size: 16,
                depth: 1
            });

            view.scale({
                axis: "y",
                divide: 5 * timeToPixel *  (maxVector.y-minVector.y)/(maxVector.x-minVector.x)
            }).ticks({
                width: 2.5,
                zBias: 1
            }).format().label({
                size: 16,
                depth: 1
            });

            view.array({
                data: [[maxVector.x, 0, 0], [0, maxVector.y, 0], [0, 0, maxVector.z]],
                channels: 3,
                live: false
            }).text({
                data: ["x", "t", "y"]
            }).label({
                color: 0x0000ff
            });

            var loader = new THREE.TextureLoader();

            function addPlane(theY, what) {

                var mat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    map: new THREE.Texture(),
                    transparent: true,
                    side: THREE.DoubleSide
                });

                loader.load('single_' + what+ '_' + theY + '.png', function (img) {
                    //img.anisotropy = maxAniso;
                    img.minFilter = THREE.LinearFilter;
                    mat.map = img;
                });


                var mesh = new THREE.Mesh(new THREE.PlaneBufferGeometry(2, 2), mat);
                mesh.renderOrder = 2;

                mesh.scale.set(
                    1.0,
                    (maxVector.z - minVector.z) / (maxVector.x - minVector.x),
                    1.0
                );

                var yV = -1 + (2 * theY) / ((maxVector.y - minVector.y));
                var yF = (timeToPixel * ((maxVector.y - minVector.y) / (maxVector.x - minVector.x)));

                mesh.position.set(0, (yV * yF), 0);
                mesh.rotation.x = -Math.PI / 2;

                return mesh;
            }

            var imageMeshes = [];

            /*for(var i= 0; i <=44; i++) {
                var mesh = addPlane(i, 'binary');
                three.scene.add(mesh);
                imageMeshes.push(mesh);
            }*/

            var showImages = true;
            var showEdgeLabels = false;

            /*
            jQuery(document).keypress(function(eventData) {

                if(eventData.key == 'h') {
                    for(var i = 0; i < imageMeshes.length; i++) {
                        imageMeshes[i].visible = !showImages;
                    }
                    showImages = !showImages;
                } else if(eventData.key == 'l') {
                    showEdgeLabels = !showEdgeLabels;
                    mathbox.select('#edgeLabelsLabels').set({visible: showEdgeLabels});
                }
            });

            */
        });


    }

});
