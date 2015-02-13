var scope;
(function(){
    var app = angular.module("GraphClientApp", []);
    app.config(function($interpolateProvider){
        $interpolateProvider.startSymbol('[[').endSymbol(']]');
    });
    app.controller("MainController", ["$scope", "$http", "$document", function($scope, $http, $document) {
        var ctx = null;
        var cy = cytoscape({
            container: document.getElementById('cy'),
            ready: function () {
                /* ENABLE CUSTOM CANVAS TO DRAW CUSTOM STUFF
                    var customCanvasRaw = document.createElement("canvas");
                    ctx = customCanvasRaw.getContext("2d");
                    ctx.beginPath();
                    ctx.moveTo(5.5, 5.5);
                    ctx.lineTo(5.5, 20);
                    ctx.lineWidth = 0.1;
                    ctx.stroke();
                    console.log(ctx);
                    var canvasContainer = angular.element(cy.container().childNodes[0]);
                    var customCanvas = angular.element(customCanvasRaw);
                    customCanvas.css("width", canvasContainer.css("width"));
                    customCanvas.css("height", canvasContainer.css("height"));
                    customCanvas.css("position", "absolute");
                    customCanvas.css("z-index", 3);
                    console.log(canvasContainer.append(customCanvas));
                */
                cy.pan({
                    x: cy.width() / 2,
                    y: cy.height() / 2
                });
            },
            selectable: true,
            layout: {name: 'preset'},
            style: cytoscape.stylesheet()
                .selector("node")
                .css({
                    "overlay-opacity": 0,
                    "shape": "rectangle",
                    "background-color": "#F9BCAC",
                    'text-valign': 'center',
                    'color': 'white',
                    'text-outline-width': 2,
                    'text-outline-color': '#888'
                })
                .selector('edge')
                .css({
                    'width': 6,
                    'line-color': '#ffaaaa',
                    'target-arrow-color': '#ffaaaa'
                })
                .selector('#edgeNode')
                .css({
                    'width': '10px',
                    'height': '6px',
                    'background-color': '#ffaaaa'
                })
                .selector("core")
                .css({
                    "selection-box-border-width": "0px",
                    "selection-box-opacity": 0,
                    "active-bg-color": "red",
                    "active-bg-opacity": 0 //disable pointer
                })
                .selector("node:selected")
                .css({
                    "overlay-opacity": 0,
                    "shape": "rectangle",
                    "background-color": '#F7D4CB'
                }),
            elements: {
                nodes: [
                    //{data: {id: 'a'}, "position": { "x": 50, "y": 200 } },
                    //{data: {id: 'b'}, "position": { "x": 150, "y": 100 } },
                    //{data: {id: 'edgeNode'}, "position": { "x": 150, "y": 200 }, classes: 'invisibleNode'}
                ],
                edges: [
                    //{data: { source: 'a', target: 'edgeNode' }},
                    //{data: { source: 'edgeNode', target: 'b' }}
                ]
            },
            renderer: {
                showFps: false
            }
        });

        var MakeSpaceTechnique = {
            BOTH: 0,
            HORI: 1,
            VERT: 2
        }
        var currentMKTechnique = MakeSpaceTechnique.BOTH;
        $document.bind('keypress', function(e) {
            if(e.which == 120) // x pressed
            {
                currentMKTechnique++;
                currentMKTechnique %= 3;
                if(NODE_RESIZE_STATE == true) {
                    resetNodePositions();
                    makeSpace(cy.elements('node').last());
                    saveNodePositions();
                    $scope.$apply();
                    console.log("make space with new technique: " + currentMKTechnique);
                }
            }
        });

        $scope.computeLayout = function() {
            $scope.showComputeLayoutButton = false;
            //update adjacencies
            var nodes = cy.elements('node');
            for(var i = 0; i < nodes.length; ++i)
            {
                lastJSONExport.nodes[i]['x_post'] = nodes[i].position().x - nodes[i].width() / 2;
                lastJSONExport.nodes[i]['y_post'] = nodes[i].position().y - nodes[i].height() / 2;
                lastJSONExport.nodes[i]['width'] = nodes[i].width();
                lastJSONExport.nodes[i]['height'] = nodes[i].height();

                if(lastJSONExport['added_node'] == nodes[i].id())
                {
                    lastJSONExport.nodes[i].x =  lastJSONExport.nodes[i]['x_post'];
                    lastJSONExport.nodes[i].y =  lastJSONExport.nodes[i]['y_post'];
                }
            }

            lastJSONExport.adjacencies = [];
            var edges = cy.elements('edge');
            for(var i = 0; i < edges.length; ++i)
            {
                var edge = edges[i];
                lastJSONExport.adjacencies.push([
                    edge.source().id(),
                    edge.target().id()
                ]);
            }

            lastJSONExport['xalign'] = [];
            lastJSONExport['yalign'] = [];
            lastJSONExport['max_swaps'] = 2;

            console.log(JSON.stringify(lastJSONExport));
            console.log(lastJSONExport);

            computeLayout(lastJSONExport);
        }


        $scope.setWidth = function() {
            var node = cy.elements('node:selected').first();
            node.css("width", nodeTexts[node.id()].style.width + "px");
            updateNodeTextStyle();
        }

        $scope.setHeight = function() {
            var node = cy.elements('node:selected').first();
            node.css("height", nodeTexts[node.id()].style.height + "px");
            updateNodeTextStyle();
        }

        /*
            Move edges orthogonal when a node is dragged.
         */
        cy.on('drag', 'node', {}, function(evt){
            var node = evt.cyTarget;
            var neighborEdgeNodes = node.neighborhood('#edgeNode');
            for(var i = 0; i < neighborEdgeNodes.length; ++i)
            {
                var edgeNode = neighborEdgeNodes[i];
                if(node.position().x != edgeNode.position().x) {
                    edgeNode.position().y = node.position().y;
                }
                if(node.position().y != edgeNode.position().y) {
                    edgeNode.position().x = node.position().x;
                }
            }
            saveNodePositions();
        });

        /*
         *   Add a node when the canvas is clicked.
         *   Mouse the mouse to change the size.
         *   Click a second time to set the size.
         */
        var EDGE_TO_BE_INSERTED_STATE = false;
        var NODE_RESIZE_STATE = false;
        var NODES_DESELECTED_STATE = false;
        var PANNING_STATE = false;
        var selectedItems = 0;
        var lastJSONExport = {};
        cy.on('click', '', {}, function(evt) {
            if(PANNING_STATE)
                return;

            if(EDGE_TO_BE_INSERTED_STATE)
            {
                if(isNode(evt.cyTarget))
                {
                    var edge = cy.$('#edgeNodeToBeInserted').neighborhood('edge');
                    if(edge.source().id() != evt.cyTarget.id())
                        edge.move({ target: evt.cyTarget.id() });
                }

                cy.$('#edgeNodeToBeInserted').remove();
                EDGE_TO_BE_INSERTED_STATE = false;
                return;
            }

            var button = evt.originalEvent.button;
            if(button) //middle mouse button
            {
                if(isNode(evt.cyTarget))
                {
                    cy.add({
                        group: "nodes",
                        data: {id: "edgeNodeToBeInserted"},
                        position: {x: evt.cyPosition.x, y: evt.cyPosition.y},
                        css: {'background-color': '#ffaaaa', width: '0px', height: '0px'}
                    });
                    cy.add({
                        group: "edges",
                        data: {source: evt.cyTarget.id(), target: 'edgeNodeToBeInserted'},
                        position: {x: evt.cyPosition.x, y: evt.cyPosition.y}
                    });

                    EDGE_TO_BE_INSERTED_STATE = true;
                }
            } else { //left mouse button
                if(NODES_DESELECTED_STATE) {
                    NODES_DESELECTED_STATE = false;
                    return;
                }

                if(!NODE_RESIZE_STATE && !isNode(evt.cyTarget)) {
                    var node = cy.add({
                        group: "nodes",
                        data: {'title': 'title', 'desc': 'description'},
                        position: {x: evt.cyPosition.x, y: evt.cyPosition.y},
                        css: {'content': ''}
                    });
                    lastJSONExport = exportToJSON();
                    makeSpace(node);
                    NODE_RESIZE_STATE = true;
                } else {
                    NODE_RESIZE_STATE = false;
                    lastMousePosition = null;
                    $scope.makeSpaceOverlay = null;
                    $scope.showComputeLayoutButton = true;
                    saveNodePositions();
                }
            }
        });

        /*
            keep track of the current selected nodes to disable the "add node" functionality
            when nodes will be deselected with a click
        */
        cy.on('select', 'node', {}, function(evt) {
            if(evt.cyTarget.data("isSelected") != true) {
                evt.cyTarget.data("isSelected", true);
                selectedItems++;
            }

            if(selectedItems == 1) {
                $scope.singleNodeSelected = nodeTexts[cy.elements('node:selected').first().id()];
            } else {
                $scope.singleNodeSelected = null;
            }

            if(selectedItems > 1)
                $scope.showAlignButtons = true;
            $scope.$apply();


        });
        cy.on('unselect', 'node', {}, function(evt) {
            for(var i = 0; i < evt.cyTarget.length; ++i)
                evt.cyTarget[i].data("isSelected", false);

            selectedItems -= evt.cyTarget.length;
            if(selectedItems == 0)
                NODES_DESELECTED_STATE = true;

            if(selectedItems != 1) {
                $scope.singleNodeSelected = null;
                $scope.$apply();
            }

            if(selectedItems < 1)
                $scope.showAlignButtons = false;
        });

        var lastMousePosition = null;
        cy.on('mousemove ', '', {}, function(evt){
            //when the left mouse button is not pressed the user is not dragging
            if(evt.originalEvent.which == 0) {
                PANNING_STATE = false;
            }

            if(EDGE_TO_BE_INSERTED_STATE)
            {
                var node = cy.$('#edgeNodeToBeInserted');
                node.position().x = evt.cyPosition.x;
                node.position().y = evt.cyPosition.y;
                cy.forceRender();
            }

           if(NODE_RESIZE_STATE)
           {
               var newPosition = evt.cyPosition;
                if(lastMousePosition != null)
                {
                    var diffX = newPosition.x - lastMousePosition.x;
                    var diffY = newPosition.y - lastMousePosition.y;

                    var node = cy.elements().last();
                    node.css("width", node.width() + diffX + "px");
                    node.css("height", node.height() + diffY + "px");

                    makeSpace(node);
                }
               lastMousePosition = newPosition;
               updateNodeTextStyle();
           }
        });

        cy.on('zoom', '', {}, function() {
            saveNodePositions();
        });

        cy.on('pan', '', {}, function() {
            console.log("pan");
            PANNING_STATE = true;
            saveNodePositions();
        });

        function isNode(target) {
            return target.isNode != undefined && target.isNode();
        }


        var nodePositions = [];
        var nodeTexts = {};
        function saveNodePositions()
        {
            var nodes = cy.elements('node');
            nodePositions = [];
            for(var i = 0; i < nodes.length; ++i)
            {
                var pos = nodes[i].position();
                var renPos = nodes[i].renderedPosition();
                var w = nodes[i].width();
                var h = nodes[i].height();
                nodePositions.push({
                    id: nodes[i].id(),
                    position: {x: pos.x, y: pos.y},
                    width: w,
                    height: h
                });
            }
            updateNodeTextStyle();
        }

        function resetNodePositions() {
            var nodes = cy.elements('node');
            for(var i = 0; i < nodes.length; ++i)
            {
                var node = nodes[i];
                node.position().x = lastJSONExport.nodes[i].x + lastJSONExport.nodes[i].width / 2;
                node.position().y = lastJSONExport.nodes[i].y + lastJSONExport.nodes[i].height / 2;
            }
            cy.forceRender();
            $scope.$apply();
        }

        function updateNodeTextStyle() {
            var nodes = cy.elements('node');
            for(var i = 0; i < nodePositions.length; ++i)
            {
                if(nodePositions[i].id == nodes[i].id())
                {
                    //initial text
                    if(nodeTexts[nodes[i].id()] == undefined) {
                        nodeTexts[nodes[i].id()] = {
                            title: "Title",
                            description: "Description"
                        };
                    }

                    //update style and positioning on the screen
                    var renPos = nodes[i].renderedPosition();
                    var w = nodes[i].width();
                    var h = nodes[i].height();
                    nodeTexts[nodePositions[i].id].style = {
                        "left": renPos.x - (w * cy.zoom()) / 2,
                        "top": renPos.y - (h * cy.zoom()) / 2,
                        "width": w * cy.zoom(),
                        "height": h * cy.zoom()
                    };

                } else {
                    console.log("WRONG ID"); // should not happen
                }
            }

            $scope.nodeTexts = nodeTexts;
            if ($scope.$root.$$phase != '$apply' && $scope.$root.$$phase != '$digest') {
                $scope.$apply();
            }
        }

        var MINIMUM_SPACE_BETWEEN_NODES = 30;
        function makeSpace(node)
        {
            var nodes = nodePositions;
            if(nodes.length < 0)
                return;

            var nodePosition = node.position();
            var leftBoundary = nodePosition.x - node.width() / 2 - MINIMUM_SPACE_BETWEEN_NODES;
            var rightBoundary = nodePosition.x + node.width() / 2 + MINIMUM_SPACE_BETWEEN_NODES;
            var topBoundary = nodePosition.y - node.height() / 2 - MINIMUM_SPACE_BETWEEN_NODES;
            var bottomBoundary = nodePosition.y + node.height() / 2 + MINIMUM_SPACE_BETWEEN_NODES;

            /*
             * compute overlay
             */
            var leftOverlayBoundary = node.renderedPosition().x - node.width() * cy.zoom() / 2 - MINIMUM_SPACE_BETWEEN_NODES;
            var rightOverlayBoundary = node.renderedPosition().x + node.width() * cy.zoom() / 2 + MINIMUM_SPACE_BETWEEN_NODES;
            var topOverlayBoundary = node.renderedPosition().y - node.height() * cy.zoom() / 2 - MINIMUM_SPACE_BETWEEN_NODES;
            var bottomOverlayBoundary = node.renderedPosition().y + node.height() * cy.zoom() / 2 + MINIMUM_SPACE_BETWEEN_NODES;
            $scope.makeSpaceOverlay = {style: {}};
            switch(currentMKTechnique){
                case MakeSpaceTechnique.BOTH:
                    $scope.makeSpaceOverlay.style.topLeft = { 'width': leftOverlayBoundary + 'px', height: topOverlayBoundary + 'px', left: '0px', top: '0px' };
                    $scope.makeSpaceOverlay.style.topRight = { 'width': cy.width() - rightOverlayBoundary + 'px', height: topOverlayBoundary + 'px', left: rightOverlayBoundary + 'px', top: '0px' };
                    $scope.makeSpaceOverlay.style.bottomLeft = { 'width': leftOverlayBoundary + 'px', height: cy.height() - bottomOverlayBoundary + 'px', left: '0px', top: bottomOverlayBoundary + 'px' };
                    $scope.makeSpaceOverlay.style.bottomRight = { 'width': cy.width() - rightOverlayBoundary + 'px', height: cy.height() - bottomOverlayBoundary + 'px', left: rightOverlayBoundary + 'px', top: bottomOverlayBoundary + 'px' };
                    break;
                case MakeSpaceTechnique.HORI:
                    $scope.makeSpaceOverlay.style.topLeft = { 'width': cy.width() + 'px', height: topOverlayBoundary + 'px', left: '0px', top: '0px' };
                    $scope.makeSpaceOverlay.style.topRight = { 'width': '0px', height: '0px', left: '0px', top: '0px' };
                    $scope.makeSpaceOverlay.style.bottomLeft = { 'width': cy.width() + 'px', height: cy.height() - bottomOverlayBoundary + 'px', left: '0px', top: bottomOverlayBoundary + 'px' };
                    $scope.makeSpaceOverlay.style.bottomRight = { 'width': '0px', height: '0px', left: '0px', top: '0px' };
                    break;
                case MakeSpaceTechnique.VERT:
                    $scope.makeSpaceOverlay.style.topLeft = { 'width': leftOverlayBoundary + 'px', height: cy.height() + 'px', left: '0px', top: '0px' };
                    $scope.makeSpaceOverlay.style.topRight = { 'width': cy.width() - rightOverlayBoundary + 'px', height: cy.height() + 'px', left: rightOverlayBoundary + 'px', top: '0px' };
                    $scope.makeSpaceOverlay.style.bottomLeft = { 'width': '0px', height: '0px', left: '0px', top: '0px' };
                    $scope.makeSpaceOverlay.style.bottomRight = { 'width': '0px', height: '0px', left: '0px', top: '0px' };
                    break;
            };


            var closestLeft, closestRight, closestBottom, closestTop;
            for(var i = 0; i < nodes.length; ++i)
            {
                if(nodes[i].id == node.id()) {
                    continue;
                }

                var horizontalDistance = nodePosition.x - nodes[i].position.x;
                var verticalDistance = nodePosition.y - nodes[i].position.y;
                if(horizontalDistance >= 0 && (closestLeft == undefined || closestLeft.dist > horizontalDistance))
                    closestLeft = {node: nodes[i], dist: horizontalDistance};

                if(horizontalDistance < 0 && (closestRight == undefined || closestRight.dist < horizontalDistance))
                    closestRight = {node: nodes[i], dist: horizontalDistance};


                if(verticalDistance >= 0 && (closestTop == undefined || closestTop.dist > verticalDistance))
                    closestTop = {node: nodes[i], dist: verticalDistance};

                if(verticalDistance < 0 && (closestBottom == undefined || closestBottom.dist < verticalDistance))
                    closestBottom = {node: nodes[i], dist: verticalDistance};
            }

            var translationLeft = 0, translationRight = 0, translationTop = 0, translationBottom = 0;
            if(closestLeft) {
                var closestNodeLeftBoundary = closestLeft.node.position.x + closestLeft.node.width / 2;
                if (closestNodeLeftBoundary > leftBoundary)
                    translationLeft = leftBoundary - closestNodeLeftBoundary;
            }

            if(closestRight) {
                var closestNodeRightBoundary = closestRight.node.position.x - closestRight.node.width / 2;
                if (closestNodeRightBoundary < rightBoundary)
                    translationRight = rightBoundary - closestNodeRightBoundary;
            }

            if(closestTop) {
                var closestNodeTopBoundary = closestTop.node.position.y + closestTop.node.height / 2;
                if (closestNodeTopBoundary > topBoundary)
                    translationTop = topBoundary - closestNodeTopBoundary;
            }

            if(closestBottom) {
                var closestNodeBottomBoundary = closestBottom.node.position.y - closestBottom.node.height / 2;
                if (closestNodeBottomBoundary < bottomBoundary)
                    translationBottom = bottomBoundary - closestNodeBottomBoundary;
            }


            for(var i = 0; i < nodes.length; ++i) {

                if (nodes[i].id == node.id())
                    continue;

                var curPos = nodes[i].position;
                if (currentMKTechnique != MakeSpaceTechnique.HORI) {
                    if (curPos.x < nodePosition.x) {
                        cy.$("#" + nodes[i].id).position().x = nodes[i].position.x + translationLeft;
                    }
                    else {
                        cy.$("#" + nodes[i].id).position().x = nodes[i].position.x + translationRight;
                    }
                }

                if (currentMKTechnique != MakeSpaceTechnique.VERT) {
                    if (curPos.y < nodePosition.y) {
                        cy.$("#" + nodes[i].id).position().y = nodes[i].position.y + translationTop;
                    }
                    else {
                        cy.$("#" + nodes[i].id).position().y = nodes[i].position.y + translationBottom;
                    }
                }
            }
        }

        function computeLayout(json)
        {
            function callback(data) {
                var nodes = cy.elements('node');
                for(var i = 0; i < nodes.length; ++i)
                {
                    var node = nodes[i];
                    node.position().x = data[node.id()][0] + node.width() / 2;
                    node.position().y = data[node.id()][1] + node.height() / 2;
                }
                saveNodePositions();
                cy.forceRender();
            };
/*
            data = {
                'nodes': [
                    {'id': 'n0', 'x': 1, 'y': 1, 'height': 10, 'width': 10},
                    {'id': '2', 'x': 22, 'y': 1, 'height': 10, 'width': 30},
                    {'id': '3', 'x': 1, 'y': 12, 'height': 10, 'width': 50},
                ],
                'adjacencies': [
                    ['n0', '2'], ['2', '3'], ['n0', '3'],
                ],
                'added_node': '3'
            }
*/

            Dajaxice.solver.optimize(callback, {'data': json});
        }

        function exportToJSON() {
            var result = {
                'nodes': [],
                'adjacencies': [],
                'added_node': cy.elements('node').last().id()
            };
            var nodes = cy.elements('node');
            for(var i = 0; i < nodes.length; ++i)
            {
                var node = nodes[i];
                result.nodes.push({
                    'id': node.id(),
                    'x': node.position().x - node.width() / 2,
                    'y': node.position().y - node.height() / 2,
                    'height': node.height(),
                    'width': node.width()
                });
            }

            var edges = cy.elements('edge');
            for(var i = 0; i < edges.length; ++i)
            {
                var edge = edges[i];
                result.adjacencies.push([
                    edge.source().id(),
                    edge.target().id()
                ]);
            }
            return result;
        }

    }]);
}());