'''
Created on Feb 3, 2015

@author: tinloaf
'''
import gurobipy as g
from solver.models import DataSet

from itertools import islice, combinations
EPS=10

def window(seq, n=2):
    "Returns a sliding window (of width n) over data from the iterable"
    "   s -> (s0,s1,...s[n-1]), (s1,s2,...,sn), ...                   "
    it = iter(seq)
    result = tuple(islice(it, n))
    if len(result) == n:
        yield result    
    for elem in it:
        result = result[1:] + (elem,)
        yield result
        
class ILPBuilder(object):
    def __init__(self, dataset, allow_switches, switch_badness, stretch_upper, stretch_badness):
        self.allow_switches = allow_switches 
        self.switch_badness = switch_badness
        self.ds = dataset
        self.stretch_upper = stretch_upper
        self.stretch_badness = stretch_badness
    
    def _make_switch_constraints(self):
        expr = g.LinExpr()
        for (v1, v2) in self.switch_x_vars:
            expr.add(self.switch_x_vars[(v1,v2)], 1.0)
            
        for (v1, v2) in self.switch_y_vars:
            expr.add(self.switch_y_vars[(v1,v2)], 1.0)
            
        self.ilp.addConstr(expr, g.GRB.LESS_EQUAL, self.allow_switches, name='switch_count')
                       
    def _make_switch_indicators(self):
        self.switch_x_vars = {}
        self.switch_y_vars = {}
        
        if (self.allow_switches <= 0):
            return 
        
        x_sorted = sorted(self.ds.nodes, key=lambda node : node.x)
        last_v = x_sorted[0].v
        for v in (n.v for n in x_sorted[1:]):
            self.switch_x_vars[(last_v,v)] = self.ilp.addVar(vtype=g.GRB.BINARY, name='switch_x_%s_%s' % (last_v, v))
            
        y_sorted = sorted(self.ds.nodes, key=lambda node : node.y)
        last_v = y_sorted[0].v
        for v in (n.v for n in y_sorted[1:]):
            self.switch_y_vars[(last_v,v)] = self.ilp.addVar(vtype=g.GRB.BINARY, name='switch_y_%s_%s' % (last_v, v))
            
        self.ilp.update()
    
    def _compute_Ms(self):
        maxx = max((node.x for node in self.ds.nodes))
        minx = min((node.x for node in self.ds.nodes))
        self.x_direction_m = ((maxx - minx) + self.ds.added_node.width) * 3
        
        maxy = max((node.y for node in self.ds.nodes))
        miny = min((node.y for node in self.ds.nodes))
        self.y_direction_m = ((maxy - miny) + self.ds.added_node.height) * 3
        
    def _make_order_constraints(self):
        x_sorted = sorted(self.ds.nodes, key=lambda node : node.x)       
        for (n1, n2, n3) in window(x_sorted, n=3):
            var1 = self.xvars[n1.v]
            var2 = self.xvars[n2.v]
            var3 = self.xvars[n3.v]
            
            direct_expr = g.LinExpr()
            direct_expr.add(var3, 1)
            direct_expr.add(var2, -1)
            if ((n2.v, n3.v) in self.switch_x_vars):
                direct_expr.add(self.switch_x_vars[(n2.v, n3.v)], self.x_direction_m)
            
            self.ilp.addConstr(direct_expr, g.GRB.GREATER_EQUAL, 0, name='x_order_1_%s' % (n3.v,))
            self.ilp.addConstr(var3 - var1, g.GRB.GREATER_EQUAL, 0, name='x_order_2_%s' % (n3.v,))
        
        y_sorted = sorted(self.ds.nodes, key=lambda node : node.y)
        for (n1, n2, n3) in window(y_sorted, n=3):
            var1 = self.yvars[n1.v]
            var2 = self.yvars[n2.v]
            var3 = self.yvars[n3.v]
            
            direct_expr = g.LinExpr()
            direct_expr.add(var3, 1)
            direct_expr.add(var2, -1)
            if ((n2.v, n3.v) in self.switch_y_vars):
                direct_expr.add(self.switch_y_vars[(n2.v, n3.v)], self.y_direction_m)
            
            self.ilp.addConstr(direct_expr, g.GRB.GREATER_EQUAL, 0, name='y_order_1_%s' % (n3.v,))
            self.ilp.addConstr(var3 - var1, g.GRB.GREATER_EQUAL, 0, name='y_order_2_%s' % (n3.v,))
            
            
    def _create_position_optimization(self):
        expr = g.LinExpr()
        self.total_opt_distance = 0
        for (node1, node2) in self.ds.adjacencies:
            n1x = self.xvars[node1.v]
            n2x = self.xvars[node2.v]
            n1y = self.yvars[node1.v]
            n2y = self.yvars[node2.v]
            
            if node1.v == self.ds.added_node.v or node2.v == self.ds.added_node.v:
                dx = node1.post_x - node2.post_x
                dy = node1.post_y - node2.post_y
            else:                        
                dx = node1.x - node2.x
                dy = node1.y - node2.y
            
            self.total_opt_distance += dx
            self.total_opt_distance += dy   
                     
            xdistvar = self.ilp.addVar(vtype=g.GRB.CONTINUOUS)
            ydistvar = self.ilp.addVar(vtype=g.GRB.CONTINUOUS)
            self.ilp.update()
            
            self.ilp.addConstr(xdistvar - (n1x - n2x - (dx * self.stretch_var)), g.GRB.GREATER_EQUAL, 0, "xdistvar_1_%s_%s" % (node1.v, node2.v))
            self.ilp.addConstr(xdistvar - (-n1x + n2x + (dx * self.stretch_var)), g.GRB.GREATER_EQUAL, 0, "xdistvar_2_%s_%s" % (node1.v, node2.v))           
            
            self.ilp.addConstr(ydistvar - (n1y - n2y - (dy * self.stretch_var)), g.GRB.GREATER_EQUAL, 0, "ydistvar_1_%s_%s" % (node1.v, node2.v))
            self.ilp.addConstr(ydistvar - (-n1y + n2y + (dy * self.stretch_var)), g.GRB.GREATER_EQUAL, 0, "ydistvar_2_%s_%s" % (node1.v, node2.v))          
            
            if (self.ds.added_node == node1) or (self.ds.added_node == node2):
                factor = len(self.ds.nodes) * 1.0
            else:
                factor = 1.0
            
            expr.add(xdistvar, factor)
            expr.add(ydistvar, factor)
            
        expr.add(self.stretch_var, (self.stretch_badness * self.total_opt_distance))
            
        return expr
    
    def _create_switch_optimization(self, expr):
        factor = self.total_opt_distance * self.switch_badness
        
        for (v1, v2) in self.switch_x_vars:
            expr.add(self.switch_x_vars[(v1,v2)], factor)
            
        for (v1, v2) in self.switch_y_vars:
            expr.add(self.switch_y_vars[(v1,v2)], factor)
            
        return expr
    
    def _make_overlapping_constraint(self, node1, node2):
        n1x = self.xvars[node1.v]
        n2x = self.xvars[node2.v]
        n1y = self.yvars[node1.v]
        n2y = self.yvars[node2.v]
        
        xory = self.ilp.addVar(vtype=g.GRB.BINARY, name='xory_%s_%s' % (node1.v, node2.v))
        right = self.ilp.addVar(vtype=g.GRB.BINARY, name="%s_right_of_%s" % (node1.v, node2.v))
        above = self.ilp.addVar(vtype=g.GRB.BINARY, name="%s_on_top_of_%s" % (node1.v, node2.v))
        self.ilp.update()

        right_constr = g.LinExpr()
        right_constr.add(n1x, 1)
        right_constr.add(n2x, -1)
        right_constr.add(node2.width, -1)
        right_constr.add(right, self.x_direction_m)
        
        right_constr.add(self.x_direction_m)
        right_constr.add(xory, -1 * self.x_direction_m)
        
        left_constr = g.LinExpr()
        left_constr.add(n1x, -1)
        left_constr.add(n2x, 1)
        left_constr.add(node1.width, -1)
        left_constr.add(self.x_direction_m)
        left_constr.add(right, -1 * self.x_direction_m)
 
        left_constr.add(self.x_direction_m)
        left_constr.add(xory, -1 * self.x_direction_m)
                
        self.ilp.addConstr(right_constr - EPS, g.GRB.GREATER_EQUAL, 0, name="x_overlap_right_%s_%s" % (node2.v, node1.v))
        self.ilp.addConstr(left_constr - EPS, g.GRB.GREATER_EQUAL, 0, name="x_overlap_left_%s_%s" % (node1.v, node2.v)) 

        top_constr = g.LinExpr()
        top_constr.add(n1y, 1)
        top_constr.add(n2y, -1)
        top_constr.add(node2.height, -1)
        top_constr.add(above, self.y_direction_m)
        
        top_constr.add(xory, self.y_direction_m)
        
        bottom_constr = g.LinExpr()
        bottom_constr.add(n1y, -1)
        bottom_constr.add(n2y, 1)
        bottom_constr.add(node1.height, -1)
        bottom_constr.add(self.y_direction_m)
        bottom_constr.add(above, -1 * self.y_direction_m)
 
        bottom_constr.add(xory, self.y_direction_m)

        self.ilp.addConstr(bottom_constr - EPS, g.GRB.GREATER_EQUAL, 0, name="y_overlap_below_%s_%s" % (node2.v, node1.v))
        self.ilp.addConstr(top_constr - EPS, g.GRB.GREATER_EQUAL, 0, name="y_overlap_above_%s_%s" % (node2.v, node1.v))
        #self.ilp.addConstr(n1y - n2y - node2.height + self.y_direction_m * above + self.y_direction_m * xory, g.GRB.GREATER_EQUAL, 0, name="y_overlap_above_%s_%s" % (node2.v, node1.v))
        #self.ilp.addConstr(n2y - n1y - node1.height + self.y_direction_m - (above * self.y_direction_m) + self.y_direction_m * xory, g.GRB.GREATER_EQUAL, 0, name="y_overlap_below_%s_%s" % (node1.v, node2.v))
        #self.ilp.addConstr(n1y - n2y - node2.height + self.y_direction_m * above, g.GRB.GREATER_EQUAL, 0, name="y_overlap_above_%s_%s" % (node2.v, node1.v))
        #self.ilp.addConstr(n2y - n1y - node1.height + self.y_direction_m - (above * self.y_direction_m), g.GRB.GREATER_EQUAL, 0, name="y_overlap_below_%s_%s" % (node1.v, node2.v))
                
                    
    def _make_initial_overlapping_constraints(self):
        #for (node1, node2) in self.ds.adjacencies:
        for (node1, node2) in combinations(self.ds.nodes, 2):
            self._make_overlapping_constraint(node1, node2)
                
    def _make_alignment_constraints(self):
        for xaligned in self.ds.xalignment:
            reference = xaligned[0]
            for alignee in xaligned[1:]:
                diff = reference.x - alignee.x
                self.ilp.addConstr(self.xvars[reference.v] - self.xvars[alignee.v], g.GRB.EQUAL, diff, name="x_align_%s_%s" % (reference.v, alignee.v))
                
        for yaligned in self.ds.yalignment:
            reference = yaligned[0]
            for alignee in yaligned[1:]:
                diff = reference.y - alignee.y
                self.ilp.addConstr(self.yvars[reference.v] - self.yvars[alignee.v], g.GRB.EQUAL, diff, name="y_align_%s_%s" % (reference.v, alignee.v))
             
                
    def _init_ilp(self):
        self.ilp = g.Model('ilp')
        self.xvars = {}
        self.yvars = {}
        
        self.stretch_var = self.ilp.addVar(vtype=g.GRB.CONTINUOUS, name='stretchfactor')
        
        for node in self.ds.nodes:
            self.xvars[node.v] = self.ilp.addVar(vtype=g.GRB.CONTINUOUS, name="x_%s" % (node.v,))
            self.yvars[node.v] = self.ilp.addVar(vtype=g.GRB.CONTINUOUS, name="y_%s" % (node.v,))
        
        self.ilp.update()
        
        self.ilp.addConstr(self.stretch_var, g.GRB.GREATER_EQUAL, 1.0, name='stretch_lower')
        self.ilp.addConstr(self.stretch_var, g.GRB.LESS_EQUAL, self.stretch_upper, name='stretch_upper')
    
    def solution(self):
        positions = {}
        for node in self.ds.nodes:
            x = self.xvars[node.v].getAttr('x')
            y = self.yvars[node.v].getAttr('x')
            positions[node.v] = (x,y)
        return positions
    
    def _find_overlaps(self):
        pos = self.solution()
        overlaps = []
        
        for (n1, n2) in combinations(self.ds.nodes, 2):
            x_overlap = not ((pos[n2.v][0] > pos[n1.v][0] + n1.width) or (pos[n2.v][0] + n2.width < pos[n1.v][0]))
            y_overlap = not ((pos[n2.v][1] > pos[n1.v][1] + n1.height) or (pos[n2.v][1] + n2.height < pos[n1.v][1]))
            
            if x_overlap and y_overlap:
                overlaps.append((n1,n2))
                
        return overlaps
    
    def _mitigate_overlaps(self, overlaps):
        for (n1, n2) in overlaps:
             self._make_overlapping_constraint(n1, n2)
             
    def _opt_callback(self, model, where):
        if (where != g.GRB.callback.MIPSOL) and (where != g.GRB.callback.MIPNODE):
            return
        
        self.xvals = {}
        self.yvals = {}
        
        print model.cbGetSolution(model.getVars())
            
    def prepare(self):
        self._init_ilp()
        self._make_switch_indicators()
        self._compute_Ms()
        
        self._make_initial_overlapping_constraints()
        
        self._make_switch_constraints()
        self._make_order_constraints()
        
        self._make_alignment_constraints()

        
        optexpr = self._create_position_optimization()
        #optexpr = self._create_switch_optimization(optexpr)
        
        self.ilp.setObjective(optexpr, g.GRB.MINIMIZE)
        
    def optimize(self):
        #self.ilp.update()
        #self.ilp.write('/tmp/ilp.lp')
        self.ilp.optimize()
        overlaps = self._find_overlaps()
        while len(overlaps) > 0:
            print('===================================================')
            print('===> Found solution, but %s overlaps. Mitigating.' % (len(overlaps)))
            for (n1, n2) in overlaps:
                print('  => Overlapping: %s and %s' % (n1,n2))
            print('===================================================')
            self._mitigate_overlaps(overlaps)
            self.ilp.optimize()
            overlaps = self._find_overlaps()