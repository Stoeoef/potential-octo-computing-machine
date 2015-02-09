(function(){
    var app = angular.module("GraphClientApp", []);
    app.controller("MainController", ["$scope", "$http", function($scope, $http) {
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
            },
            selectable: true,
            layout: {name: 'preset'},
            style: cytoscape.stylesheet()
                .selector("node")
                .css({
                    "overlay-opacity": 0,
                    "shape": "rectangle",
                    "background-color": "black",
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
                    "background-color": "blue",
                    "border-color": "red"
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
        });

        /*
         *   Add a node when the canvas is clicked.
         *   Mouse the mouse to change the size.
         *   Click a second time to set the size.
         */
        var EDGE_TO_BE_INSERTED_STATE = false;
        var NODE_RESIZE_STATE = false;
        var NODES_DESELECTED_STATE = false;
        var selectedItems = 0;
        cy.on('click', '', {}, function(evt) {
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
                        data: {},
                        position: {x: evt.cyPosition.x, y: evt.cyPosition.y},
                        css: {'content': 'id()'}
                    });
                    node.css('content', node.id());
                    makeSpace(node);
                    NODE_RESIZE_STATE = true;
                } else {
                    NODE_RESIZE_STATE = false;
                    lastMousePosition = null;
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
        });
        cy.on('unselect', '', {}, function(evt) {
            for(var i = 0; i < evt.cyTarget.length; ++i)
                evt.cyTarget[i].data("isSelected", false);

            selectedItems -= evt.cyTarget.length;
            if(selectedItems == 0)
                NODES_DESELECTED_STATE = true;
        });

        var lastMousePosition = null;
        cy.on('mousemove ', '', {}, function(evt){
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
           }
        });

        function isNode(target) {
            return target.isNode != undefined && target.isNode();
        }

        var nodePositions = [];
        function saveNodePositions()
        {
            var nodes = cy.elements('node');
            nodePositions = [];
            for(var i = 0; i < nodes.length; ++i)
            {
                var pos = nodes[i].position();
                nodePositions.push({
                    id: nodes[i].id(),
                    position: {x: pos.x, y: pos.y},
                    width: nodes[i].width(),
                    height: nodes[i].height()
                });
            }
            console.log(nodePositions);
        }

        var MINIMUM_SPACE_BETWEEN_NODES = 30;
        function makeSpace(node)
        {
            console.log("--------------MAKE SPACE--------------")
            console.log(nodePositions);
            console.log(node.width());
            var nodes = nodePositions;
            if(nodes.length < 0)
                return;

            var nodePosition = node.position();
            var leftBoundary = nodePosition.x - node.width() / 2 - MINIMUM_SPACE_BETWEEN_NODES;
            var rightBoundary = nodePosition.x + node.width() / 2 + MINIMUM_SPACE_BETWEEN_NODES;
            var topBoundary = nodePosition.y - node.height() / 2 - MINIMUM_SPACE_BETWEEN_NODES;
            var bottomBoundary = nodePosition.y + node.height() / 2 + MINIMUM_SPACE_BETWEEN_NODES;

            console.log("bondaries");
            console.log([leftBoundary, rightBoundary]);
            console.log("bondaries end");

            var closestLeft, closestRight, closestBottom, closestTop;
            for(var i = 0; i < nodes.length; ++i)
            {
                if(nodes[i].id == node.id()) {
                    console.log("continue");
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



                console.log("closest");
                console.log(closestLeft);
                console.log(closestRight);
                console.log(closestTop);
                console.log(closestBottom);
                console.log("closest end")

                //todo top bottom
            }

            console.log("closest node positions");
            var translationLeft = 0, translationRight = 0, translationTop = 0, translationBottom = 0;
            if(closestLeft) {
                console.log(closestLeft.node.position.x);
                var closestNodeLeftBoundary = closestLeft.node.position.x + closestLeft.node.width / 2;
                if (closestNodeLeftBoundary > leftBoundary)
                    translationLeft = leftBoundary - closestNodeLeftBoundary;
            }

            if(closestRight) {
                console.log(closestRight.node.position.x);
                var closestNodeRightBoundary = closestRight.node.position.x - closestRight.node.width / 2;
                if (closestNodeRightBoundary < rightBoundary)
                    translationRight = rightBoundary - closestNodeRightBoundary;
            }

            if(closestTop) {
                console.log(closestTop.node.position.y);
                var closestNodeTopBoundary = closestTop.node.position.y + closestTop.node.height / 2;
                if (closestNodeTopBoundary > topBoundary)
                    translationTop = topBoundary - closestNodeTopBoundary;
            }

            if(closestBottom) {
                console.log(closestBottom.node.position.y);
                var closestNodeBottomBoundary = closestBottom.node.position.y - closestBottom.node.height / 2;
                if (closestNodeBottomBoundary < bottomBoundary)
                    translationBottom = bottomBoundary - closestNodeBottomBoundary;
            }

            console.log("closest node positions end");

            console.log(translationLeft);
            console.log(translationRight);
            console.log(translationTop);
            console.log(translationBottom);


            for(var i = 0; i < nodes.length; ++i)
            {

                if(nodes[i].id == node.id())
                    continue;

                var curPos = nodes[i].position;
                if(curPos.x < nodePosition.x) {
                    cy.$("#" + nodes[i].id).position().x = nodes[i].position.x + translationLeft;
                }
                else {
                    cy.$("#" + nodes[i].id).position().x = nodes[i].position.x + translationRight;
                }

                if(curPos.y < nodePosition.y) {
                    cy.$("#" + nodes[i].id).position().y = nodes[i].position.y + translationTop;
                }
                else {
                    cy.$("#" + nodes[i].id).position().y = nodes[i].position.y + translationBottom;
                }
            }

            console.log("--------------------------------------");
        }
    }]);
}());