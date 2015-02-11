'''
Created on Feb 3, 2015

@author: tinloaf
'''
import gurobipy as g
from solver.models import DataSet

class ILPBuilder(object):
    def __init__(self, dataset):
        self.ds = dataset
    
    def _make_order_constraints(self):
        x_sorted = sorted(self.ds.nodes, key=lambda node : node.x)
        last_var = self.xvars[x_sorted[0].v]
        for node in x_sorted[1:]:
            var = self.xvars[node.v]
            self.ilp.addConstr(var - last_var, g.GRB.GREATER_EQUAL, 0, name='x_order_%s' % (node.v,))
        
        y_sorted = sorted(self.ds.nodes, key=lambda node : node.y)
        last_var = self.yvars[y_sorted[0].v]
        for node in y_sorted[1:]:
            var = self.yvars[node.v]
            self.ilp.addConstr(var - last_var, g.GRB.GREATER_EQUAL, 0, name='y_order_%s' % (node.v,))
            
            
    def _create_position_optimization(self):
        expr = g.LinExpr()
        for (node1, node2) in self.ds.adjacencies:
            n1x = self.xvars[node1.v]
            n2x = self.xvars[node2.v]
            n1y = self.yvars[node1.v]
            n2y = self.yvars[node2.v]
            dx = node1.x - node2.x
            dy = node1.y - node2.y
            
            xdistvar = self.ilp.addVar(vtype=g.GRB.CONTINUOUS)
            ydistvar = self.ilp.addVar(vtype=g.GRB.CONTINUOUS)
            self.ilp.update()
            
            self.ilp.addConstr(xdistvar - (n1x - n2x - dx), g.GRB.GREATER_EQUAL, 0, "xdistvar_1_%s_%s" % (node1.v, node2.v))
            self.ilp.addConstr(xdistvar - (-n1x + n2x + dx), g.GRB.GREATER_EQUAL, 0, "xdistvar_2_%s_%s" % (node1.v, node2.v))           
            
            self.ilp.addConstr(ydistvar - (n1y - n2y - dy), g.GRB.GREATER_EQUAL, 0, "ydistvar_1_%s_%s" % (node1.v, node2.v))
            self.ilp.addConstr(ydistvar - (-n1y + n2y + dy), g.GRB.GREATER_EQUAL, 0, "ydistvar_2_%s_%s" % (node1.v, node2.v))          
            
            if (self.ds.added_node == node1) or (self.ds.added_node == node2):
                factor = len(self.ds.nodes) * 1.0
            else:
                factor = 1.0
            
            expr.add(xdistvar, factor)
            expr.add(ydistvar, factor)
            
        return expr
            
    def _make_initial_overlapping_constraints(self):
        for (node1, node2) in self.ds.adjacencies:
            n1x = self.xvars[node1.v]
            n2x = self.xvars[node2.v]
            n1y = self.yvars[node1.v]
            n2y = self.yvars[node2.v]
            
            if node1.x > (node2.x + node2.width):
                self.ilp.addConstr(n1x - n2x - node2.width, g.GRB.GREATER_EQUAL, 0, name="x_overlap_%s_%s" % (node2.v, node1.v))
            elif node2.x > (node1.x + node1.width):
                self.ilp.addConstr(n2x - n1x - node1.width, g.GRB.GREATER_EQUAL, 0, name="x_overlap_%s_%s" % (node1.v, node2.v))
                
            if (node1.y > (node2.y + node2.height)):
                self.ilp.addConstr(n1y - n2y - node2.height, g.GRB.GREATER_EQUAL, 0, name="y_overlap_%s_%s" % (node2.v, node1.v))
            elif (node2.y > (node1.y + node1.height)):
                self.ilp.addConstr(n2y - n1y - node1.height, g.GRB.GREATER_EQUAL, 0, name="y_overlap_%s_%s" % (node1.v, node2.v))
                
                
                
    def _init_ilp(self):
        self.ilp = g.Model('ilp')
        self.xvars = {}
        self.yvars = {}
        
        for node in self.ds.nodes:
            self.xvars[node.v] = self.ilp.addVar(vtype=g.GRB.CONTINUOUS, name="x_%s" % (node.v,))
            self.yvars[node.v] = self.ilp.addVar(vtype=g.GRB.CONTINUOUS, name="y_%s" % (node.v,))
        
        self.ilp.update()
    
    def solution(self):
        positions = {}
        for node in self.ds.nodes:
            x = self.xvars[node.v].getAttr('x')
            y = self.yvars[node.v].getAttr('x')
            positions[node.v] = (x,y)
        return positions
            
        
    def _opt_callback(self, model, where):
        if (where != g.GRB.callback.MIPSOL) and (where != g.GRB.callback.MIPNODE):
            return
        
        self.xvals = {}
        self.yvals = {}
        
        print model.cbGetSolution(model.getVars())
            
    def prepare(self):
        self._init_ilp()
        self._make_initial_overlapping_constraints()
        self._make_order_constraints()
        optexpr = self._create_position_optimization()
        self.ilp.setObjective(optexpr, g.GRB.MINIMIZE)
        
    def optimize(self):
        self.ilp.optimize(lambda model, where : self._opt_callback(model, where))