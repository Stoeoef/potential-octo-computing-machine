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
                .selector('edge')
                .css({
                    'width': 6,
                    'line-color': '#ffaaaa',
                    'target-arrow-color': '#ffaaaa'
                })
                .selector('#edgeNode')
                .css({
                    'width': '6px',
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
                .selector("node")
                .css({
                    "overlay-opacity": 0,
                    "shape": "rectangle",
                    "background-color": "black"
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
        var NODE_RESIZE_STATE = false;
        var selectedItems = 0;
        var NODES_DESELECTED_STATE = false;
        cy.on('click', '', {}, function(evt) {
            if(NODES_DESELECTED_STATE) {
                NODES_DESELECTED_STATE = false;
                return;
            }

            if(!NODE_RESIZE_STATE && !isNode(evt.cyTarget)) {
                cy.add({
                    group: "nodes",
                    data: {},
                    position: {x: evt.cyPosition.x, y: evt.cyPosition.y}
                });
                NODE_RESIZE_STATE = true;
            } else {
                NODE_RESIZE_STATE = false;
                lastMousePosition = null;
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

                }
               lastMousePosition = newPosition;
           }
        });

        function isNode(target) {
            return target.isNode != undefined && target.isNode();
        }
    }]);
}());