
function getChildWithName(node, name) {
    var x = node.firstChild;
    while (x != null && (x.nodeType!=1 || x.localName != name)) {
        x=x.nextSibling;
    }
    return x;
}

function getChildrenWithName(node, name) {
    var result = [];
    var x = node.firstChild;
    while (x != null) {
        if (x.nodeType == 1 && x.localName == name) {
            result.push(x);
        }
        x = x.nextSibling;
    }
    return result;
}

function loadFile(event) {
    var file = event.target.files[0];
    var parser = new DOMParser();
    var reader = new FileReader();

    reader.onload = function(xml) {
        var xmlDocument = parser.parseFromString(reader.result, "text/xml");
        var nodes = xmlDocument.getElementsByTagName("node");
        for (var i = 0; i < nodes.length; i++) {
            var node = nodes.item(i);
            var d2;
            var d3;
            for (var j = 0; j < node.childNodes.length; j++) {
                var data = node.childNodes.item(j);
                if (data.nodeType == 1) { // ElementType
                    if (data.attributes.key.value == "d3") {
                        d3 = data;
                    } else if (data.attributes.key.value == "d2") {
                        d2 = data;
                    }
                    if (d3 != undefined && d2 != undefined) {
                        break;
                    }
                }
            }
            if (getChildWithName(d2, "group") != null) {
                // ignore group nodes
                console.log("ignore group");
                continue;
            }

            var shapeNode = getChildWithName(d3, "ShapeNode");
            var geomNode = getChildWithName(shapeNode, "Geometry");
            var height = geomNode.attributes.height.value;
            var width = geomNode.attributes.width.value;
            var x = geomNode.attributes.x.value;
            var y = geomNode.attributes.y.value;

            var labels = getChildrenWithName(shapeNode, "NodeLabel");
            var title = labels[0].firstChild.data;
            var content;
            if (labels.length > 1) {
                content = labels[1].firstChild.data;
            } else {
                content = "";
            }
            console.log("height: " + height);
            console.log("node: " + node.attributes.id.value);
            console.log("title: " + title);
            console.log("content: " + content);
        }
    }
    reader.readAsText(file);
}

window.onload = function() {
    document.getElementById('loadFiles').addEventListener('change', loadFile, false);
}

