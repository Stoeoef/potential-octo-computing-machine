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

    xalign = []
    for aligned in data['xalign']:
        xalign.append([id_to_node[id] for id in aligned])
    
    yalign = []
    for aligned in data['yalign']:
        yalign.append([id_to_node[id] for id in aligned])    

    added = id_to_node[data['added_node']]
    
    ds = DataSet(nodes, adjacencies, added, xalign, yalign)
    
    if 'max_swaps' in data:
        max_swaps = data['max_swaps']
    else:
        max_swaps = 2
        
    ilp = ILPBuilder(ds, allow_switches=max_swaps)
    ilp.prepare()
    ilp.optimize()
    
    return json.dumps(ilp.solution())