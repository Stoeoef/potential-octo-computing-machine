'''
Created on Feb 11, 2015

@author: tinloaf
'''
import json
from dajaxice.decorators import dajaxice_register
from solver.models import Node, DataSet
from solver.ilp import ILPBuilder

@dajaxice_register(method='GET')
def optimize(request, data):
    nodes = []
    id_to_node = {}
    for node_data in data['nodes']:
        node = Node(node_data['id'], node_data['x'], node_data['y'], node_data['width'], node_data['height'])
        nodes.append(node)
        id_to_node[node.v] = node
     
    adjacencies = []
    for (id1, id2) in data['adjacencies']:
        adjacencies.append((id_to_node[id1], id_to_node[id2]))

    added = id_to_node[data['added_node']]
    
    ds = DataSet(nodes, adjacencies, added)
    
    ilp = ILPBuilder(ds)
    ilp.prepare()
    ilp.optimize()
    
    return json.dumps(ilp.solution())