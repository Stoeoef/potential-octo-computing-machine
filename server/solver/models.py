from django.db import models

class Node(object):
    def __init__(self, v, x, y, post_x, post_y, width, height):
        self.x = x 
        self.y = y
        self.post_x = post_x
        self.post_y = post_y
        self.width = width
        self.height = height
        self.v = v
        
class DataSet(object):
    def __init__(self, nodes, adjacencies, added_node, xalign, yalign):
        self.nodes = nodes
        self.adjacencies = adjacencies
        self.added_node = added_node
        self.xalignment = xalign
        self.yalignment = yalign