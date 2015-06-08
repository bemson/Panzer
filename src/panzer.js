/*!
 * Panzer v0.3.13 by Bemi Faison
 * http://github.com/bemson/Panzer
 *
 * Dependencies:
 * genData v3.1.0 / Bemi Faison / MIT / http://github.com/bemson/genData
 *
 * Copyright 2012, Bemi Faison
 * Released under the MIT License
 */
!function (inAMD, inCJS, Array, Object, RegExp, scope, undefined) {

  // dependent module initializer
  function initPanzer(require) {
    var
      genData = (inCJS || inAMD) ? require('genData') : scope.genData,
      panzerInstanceCount = 0,
      postCallbackCount = 0,
      ObjecttoStringResult = ({}).toString(),
      protoHas = Object.prototype.hasOwnProperty,
      // build node-tree
      genNodes = genData.spawn(
        function (name, value, parent, flags) {
          var
            node = this,
            panzer = flags.args[0],
            keyTestMap = flags.args[1],
            nodes = flags.returns,
            isBadKey = keyTestMap && name &&
              (keyTestMap.nf.some(passKeyFnc) || keyTestMap.nr.some(passKeyRxp)),
            isAttrKey = keyTestMap && name &&
              (keyTestMap.af.some(passKeyFnc) || keyTestMap.ar.some(passKeyRxp)),
            alternateSourceObject,
            pkg,
            pkgIdx = 0
          ;

          function passKeyFnc(badFnc) {
            return badFnc.call(scope, name, value);
          }
          function passKeyRxp(badRxp) {
            return badRxp.test(name);
          }

          if (isBadKey || isAttrKey) {
            // don't scan further
            flags.source = 0;

            if (isAttrKey) {
              parent.attrs[name] = value;
            }
          } else {

            // init properties (for faster lookups)
            node.parentIndex =
            node.previousIndex =
            node.nextIndex =
            node.firstChildIndex =
            node.lastChildIndex =
            node.childIndex =
            node.ctx =
            node.lte =
              -1;
            node.index = nodes.push(node);
            node.depth = parent ? parent.depth + 1 : 1;
            node.name = name || 'PROOT';
            node.attrs = {};
            node.path = parent ? parent.path + name + '/' : '//';
            node.children = [];

            // set hierarchy-related properties
            if (parent) {

              node.parentIndex = parent.index;
              if (!parent.children.length) {
                parent.firstChildIndex = node.index;
              }
              node.childIndex = parent.children.push(node.index) - 1;
              parent.lastChildIndex = node.index;

              // update younger sibling
              if (node.childIndex) {
                node.previousIndex = parent.children[node.childIndex - 1];
                nodes[node.previousIndex - 1].nextIndex = node.index;
              }

            } else {
              // capture original object (for node prep calls)
              flags.tree = value;
            }
            // let each packager alter this node's structure
            if (panzer && panzer.pkgs.length) {
              for (; pkg = panzer.pkgs[pkgIdx]; pkgIdx++) {
                if (
                  typeof pkg.def.prepNode === 'function' &&
                  typeof (alternateSourceObject = pkg.def.prepNode.call(scope, flags.source, flags.tree)) !== 'undefined'
                ) {
                  flags.source = alternateSourceObject;
                }
              }
            }
          }
        }
      ),
      // clone nodes generated by genNodes
      genCloneNodes = genData.spawn(
        function (name, originalNode, parent, flags) {
          var
            node = this,
            member
          ;
          if (parent) {
            // don't scan further
            flags.source = 0;

            // copy non-tracking members from this node
            for (member in originalNode) {
              if (protoHas.call(originalNode, member) && member !== 'lte' && member !== 'ctx') {
                node[member] = originalNode[member];
              }
            }
            // add to the cloned array
            return node;
          }
        }
      ),
      r_hasAlphanumeric = /\w/
    ;


    function isFullString(value) {
      return value && typeof value === 'string';
    }


    // basic event emitter methods
    // to be used as a suite

    function OnEventer(evt, callback) {
      var me = this;

      if (
        isFullString(evt) &&
        typeof callback === 'function'
      ) {
        if (!protoHas.call(me, '_evts')) {
          // init events hash
          me._evts = {};
        }
        if (!protoHas.call(me._evts, evt)) {
          // init event queue
          me._evts[evt] = [];
        }
        // add callback to event queue
        me._evts[evt].push(callback);
      }
      return me;
    }

    function OffEventer(evt, callback) {
      var
        me = this,
        cbs,
        cbLn,
        argLn = arguments.length;

      if (!protoHas.call(me, '_evts') || !argLn) {
        // reset if clearing all events
        me._evts = {};
      } else if (
        isFullString(evt) &&
        protoHas.call(me._evts, evt)
      ) {
        cbs = me._evts[evt];
        if (typeof callback == 'function') {
          cbLn = cbs.length;
          // remove the last matching callback only
          while (cbLn--) {
            if (cbs[cbLn] === callback) {
              cbs.splice(cbLn, 1);
              break;
            }
          }
        }
        // remove event queue if no callback or none left
        if (argLn < 2 || !cbs.length) {
          delete me._evts[evt];
        }
      }

      return me;
    }


    // private Tree instance
    function Tree(panzer, proxyInst, rawtree, klassConfig) {
      var
        tree = this,
        pkgProxyIdx = {},
        pkgInstIdx = {},
        keyTestMap = {
          af: [],   // attribute function tests
          ar: [],   // attribute regexp tests
          nf: [],   // node function tests
          nr: []    // node regexp tests
        },
        forLoopIdx,
        forLoopLength,
        forLoopItem,
        tmp
      ;

      // get the package instance corresponding this panzer
      function proxyToStringMethod(platform, pkgIdx) {
        if (platform === panzer && pkgIdx < tree.pkgs.length) {
          return tree.pkgs[pkgIdx].inst;
        }

        // emulate normal toString behavior
        return ObjecttoStringResult;
      }

      // catalog package key tests and preprocess the tree
      for (forLoopIdx = 0; forLoopItem = panzer.pkgs[forLoopIdx]; forLoopIdx++) {
        // cache package key tests schemes
        if (typeof forLoopItem.def.attrKey === 'function') {
          keyTestMap.af.push(forLoopItem.def.attrKey);
        } else if (forLoopItem.def.attrKey instanceof RegExp) {
          keyTestMap.ar.push(forLoopItem.def.attrKey);
        }
        if (typeof forLoopItem.def.badKey === 'function') {
          keyTestMap.nf.push(forLoopItem.def.badKey);
        } else if (forLoopItem.def.badKey instanceof RegExp) {
          keyTestMap.nr.push(forLoopItem.def.badKey);
        }

        if (
          typeof forLoopItem.def.prepTree === 'function' &&
          typeof (tmp = forLoopItem.def.prepTree.call(scope, rawtree)) !== 'undefined'
        ) {
          rawtree = tmp;
        }
      }

      // compile canonical node-tree
      tree.nodes = genNodes(rawtree, panzer, keyTestMap);

      // point tree node to it's own root
      tree.nodes[0].parentIndex =
      tree.nodes[0].childIndex =
        0;

      // build contrived "null" node
      tree.nodes.unshift(genNodes()[0]);
      tree.nodes[0].children.push(1);
      tree.nodes[0].name = 'PNULL';
      tree.nodes[0].index =
      tree.nodes[0].depth =
      tree.nodes[0].lte =
        0;
      tree.nodes[0].path = '..//';
      tree.nodes[0].firstChildIndex =
      tree.nodes[0].lastChildIndex =
        1;
      tree.nodes[0].ctx = 1;

      // privileged package api for controlling this tank
      tree.tank = {
        id: panzerInstanceCount++,
        currentIndex: 0,
        targetIndex: -1,

        // direct tank to a node
        go: function (tgtIndex) {
          var tgtNode = tree.nodes[tgtIndex];
          if (tgtNode) {
            tree.target = tgtNode;
            tree.tank.targetIndex = tgtNode.index;
          }
          // trip package stop flag
          // this only matters when in the loop
          tree.pstop = 0;
          return tree.go();
        },

        // stop the tank
        stop: function () {
          // trip package stop flag
          // this only matters when in the loop
          tree.pstop = 1;
          // return truthy when this tree is in a loop, otherwise falsy
          return !!tree.loop;
        },

        // manage post navigation callbacks
        post: function (param) {
          var paramType = typeof param;

          if (tree.loop) {
            if (paramType === 'function') {
              // add callback and return id
              tree.posts[++postCallbackCount] = param;
              return postCallbackCount;
            } else if (paramType === 'number') {
              if (protoHas.call(tree.posts, param)) {
                // remove callback with this id
                delete tree.posts[param];
                return true;
              }
            }
          }

          return false;
        }
      };
      tree.posts = {};
      tree.current = tree.nodes[0];
      tree.target =
      tree.loop =
        0;

      // compose package instances
      tree.pkgs = panzer.pkgs.map(function (pkg) {
        var
          pkgName = pkg.name,
          pkgDef = pkg.def,
          // package-instance confguration
          pkgEntry = {
            name: pkgName,
            idx: pkg.idx,
            pkg: pkg,
            inst: new pkgDef(),
            lock: 0
          }
        ;

        // define constructor to mirror this package's proxy prototype
        function pkgProxy() {}
        pkgProxy.prototype = pkg.proxy.prototype;

        // index instances for sharing
        pkgProxyIdx[pkgName] = pkgEntry.proxy = new pkgProxy();
        pkgInstIdx[pkgName] = pkgEntry.inst;

        // compose package-proxy
        pkgEntry.proxy.pkgs = pkgProxyIdx;
        pkgEntry.proxy.toString = proxyToStringMethod;

        // compose package-instance
        pkgEntry.inst.pkgs = pkgInstIdx;
        pkgEntry.inst.tank = tree.tank;
        pkgEntry.inst.nodes = genCloneNodes.call(pkg.node, tree.nodes);

        return pkgEntry;
      });

      // expose public proxy to package-instances
      for (forLoopIdx = 0; forLoopItem = tree.pkgs[forLoopIdx]; forLoopIdx++) {
        forLoopItem.inst.proxy = proxyInst;
      }

      // compose public proxy instance
      proxyInst.pkgs = pkgProxyIdx;
      proxyInst.toString = proxyToStringMethod;

      // disable tank events while initializing packages
      tree.fire = goodForNothinFunction;
      for (forLoopIdx = 0; forLoopItem = tree.pkgs[forLoopIdx]; forLoopIdx++) {
        if (typeof forLoopItem.pkg.def.init === 'function') {
          forLoopItem.pkg.def.init.call(forLoopItem.inst, klassConfig);
        }
      }
      // remove method overload
      delete tree.fire;
    }
    Tree.prototype = {

      // navigate towards a target node
      go: function () {
        var
          tree = this,
          nodes = tree.nodes,
          tank = tree.tank,
          postId,
          dir,
          pkgLn = tree.pkgs.length,
          inCurrentNode,
          traversalCount = 0,
          resuming = tree.stopped,
          curNode = tree.current,
          nextPhase = resuming ? curNode.lte : -1,
          nextNodeIndex = -1,
          lastTargetIndex = resuming ? tree.target.index : null,
          nodeEngaged,
          endEventFired
        ;

        // exit when already looping
        if (tree.loop) {
          return !!tree.target;
        }

        // reset loop flags
        tree.posts = {};
        tree.loop = 1;
        tree.stop = 0;

        // reset pkgEntry locks
        while (pkgLn--) {
          tree.pkgs[pkgLn].lock = 0;
        }

        tree.fire('begin');

        // navigate towards the target node, until stopped
        while (tree.loop) {
          if ((resuming || tree.target) && !tree.stop) {
            endEventFired = 0;
            if (lastTargetIndex != tree.target.index || !(~nextPhase | ~nextNodeIndex)) {

              // reset tracking variables
              inCurrentNode = curNode.ctx === 1;
              nextPhase = nextNodeIndex = -1;
              lastTargetIndex = tree.target.index;
              dir = lastTargetIndex - curNode.index;

              // determine where to navigate next
              if (dir) {
                if ((dir > 0 && curNode.index < 2) || !tree.target.path.indexOf(curNode.path)) {
                  if (inCurrentNode) {
                    // change to first child node
                    nextNodeIndex = curNode.firstChildIndex;
                  } else {
                    // traverse into the current node
                    nextPhase = 1;
                  }
                } else {
                  if (inCurrentNode) {
                    // traverse out of the current node
                    nextPhase = 2;
                  } else {
                    if (tree.target.path.indexOf(nodes[curNode.parentIndex].path)) {
                      // reverse direction (in order to exit a branch)
                      dir = -1;
                    }
                    if (dir > 0) {
                      if (curNode.lte == 3 || curNode.lte == 2) {
                        // change to next sibling node
                        nextNodeIndex = curNode.nextIndex;
                      } else {
                        // traverse over the current node
                        nextPhase = 3;
                      }
                    } else {
                      if (curNode.lte == 4 || curNode.lte == 2) {
                        // change to previous sibling node, if not the parent node
                        nextNodeIndex = ~curNode.previousIndex ? curNode.previousIndex : curNode.parentIndex;
                      } else {
                        // traverse backwards, over the current node
                        nextPhase = 4;
                      }
                    }
                  }
                }
              } else {
                // traverse into or on the current node
                nextPhase = inCurrentNode ? 0 : 1;
              }
            } else if (~nextNodeIndex) {
              // change - after disengaging - the current node
              if (nodeEngaged) {
                nodeEngaged = 0;
                tree.fire('release');
              } else {
                tank.currentIndex = nextNodeIndex;
                tree.fire('node', nextNodeIndex, curNode.index);
                curNode.lte = 0;
                curNode = tree.current = nodes[nextNodeIndex];
                nextNodeIndex = -1;
              }
            } else if (!nodeEngaged) {
                // engage the current node
                nodeEngaged = 1;
                tree.fire('engage');
            } else if (!inCurrentNode && !resuming && (nextPhase == 1 || nextPhase == 2)) {
              if (nextPhase == 2) {
                // clear target phase
                nextPhase = -1;
              } else {
                // enter the current node
                inCurrentNode = curNode.ctx = 1;
              }
              // fire scope in/out event
              tree.fire('scope', curNode.ctx);
            } else {
              // perform designated traversal
              if (resuming) {
                tree.fire('traversing', nextPhase);
              } else {
                curNode.lte = nextPhase;

                // reset flags when traversing "on" the current node
                if (!nextPhase) {
                  tree.target = 0;
                  tank.targetIndex = -1;
                }

                tree.fire('traverse', nextPhase);
              }

              traversalCount++;

              if (!tree.stop) {
                // end uninterupted traversal event
                tree.fire('traversed', nextPhase);
                tree.stopped = 0;
              }
              // flag stopped traversals (allows stopping during "traversed" event as well)
              tree.stopped = tree.stop;
              resuming = 0;

              if (nextPhase == 2) {
                // exit the current node
                inCurrentNode = curNode.ctx = 0;
              } else {
                nextPhase = -1;
              }
            }
          } else if (nodeEngaged) {
            // release this node
            nodeEngaged = 0;
            tree.fire('release');
          } else if (!endEventFired) {
            // end navigation
            endEventFired = 1;
            tree.fire('end');
          } else {
            // end loop
            tree.loop = 0;
          }
        }

        // execute post-loop callback functions
        for (postId in tree.posts) {
          if (protoHas.call(tree.posts, postId)) {
            tree.posts[postId].call(scope);
          }
        }

        return traversalCount;
      },

      // invoke package event handlers
      fire: function (eventName) {
        var
          tree = this,
          pkgIdx = 0,
          pkgEntry,
          pkgDef,
          pkgInst,
          pkgLock,
          params = arguments,
          cbQueue,
          cbQueueLn,
          cbIdx,
          invoker
        ;

        if (params.length) {
          invoker = function (cb) {
            cb.apply(pkgInst, params);
          };
        } else {
          invoker = function (cb) {
            cb.call(pkgInst, eventName);
          };
        }

        // fire event on definition
        // execute each package's callback queue
        for (; pkgEntry = tree.pkgs[pkgIdx]; pkgIdx++) {
          // alias the package definition
          pkgDef = pkgEntry.pkg.def;

          // execute subscribers
          if (
            protoHas.call(pkgDef, '_evts') &&
            protoHas.call(pkgDef._evts, eventName)
          ) {
            // alias callback queue
            cbQueue = pkgDef._evts[eventName];
            cbQueueLn = cbQueue.length;

            // capture pkg instance
            pkgInst = pkgEntry.inst;

            // copy current package lock flag
            pkgLock =
            tree.pstop =
              pkgEntry.lock;

            // invoke event subscribers from this package
            for (cbIdx = 0; cbIdx < cbQueueLn; cbIdx++) {
              invoker(cbQueue[cbIdx]);
            }

            // if the package lock has changed...
            if (pkgLock != tree.pstop) {
              // capture new package lock
              pkgLock =
              pkgEntry.lock =
                tree.pstop;
              // increment or decrement stop flag, based on current lock
              if (pkgLock) {
                tree.stop += 1;
              } else {
                tree.stop -= 1;
              }
            }
          }
        }
      }

    };


    // get or create package for a Panzer Klass
    function ResolveOrRegisterKlassPackage(pkgName) {
      var
        panzer = this,
        pkgIdx
      ;

      if (arguments.length) {

        if (typeof pkgName === 'string' && r_hasAlphanumeric.test(pkgName)) {

          // create non-existent package
          if (!protoHas.call(panzer.pkgsIdx, pkgName)) {

            // define a package definition function, which returns the private instance of it's public proxy
            function Pkg(proxyInst) {
              // return the package instance registered at this package definitions index (or false)
              if (proxyInst) {
                return proxyInst instanceof panzer.pkgs[pkgIdx].proxy && proxyInst.toString(panzer, pkgIdx);
              }
            }
            Pkg.getSuper = panzer.getSuper;

            // add emitter methods
            Pkg.on = OnEventer;
            Pkg.off = OffEventer;

            // init package members
            Pkg.init =             // initializer for this package
            Pkg.attrKey =          // what defines tag/node-attribute
            Pkg.badKey =           // what a node may not be named
            Pkg.prepTree =         // alter the entire tree before compilation
            Pkg.prepNode =         // alter a node during compilation
              0;

            function PkgProxyForKlass() {}
            // extend current public protoype chain
            PkgProxyForKlass.prototype = new panzer.KlassProxy();
            // replace public prototype and expose via this package's proxy member
            panzer.Klass.prototype = Pkg.proxy = PkgProxyForKlass.prototype;
            // replace public prototype constructor
            panzer.KlassProxy = PkgProxyForKlass;

            // define node for this package
            function PkgNodeModel() {}
            Pkg.node = PkgNodeModel.prototype;

            // register this package for this panzer, by name and index
            pkgIdx =
            Pkg.index =
            panzer.pkgsIdx[pkgName] =
              panzer.pkgs.push({
                name: pkgName,
                idx: panzer.pkgs.length,
                def: Pkg,
                proxy: PkgProxyForKlass,
                node: PkgNodeModel
              }) - 1;
            panzer.defs.push(panzer.pkgs[panzer.pkgs.length - 1].def);
          }
          // return package definition
          return panzer.pkgs[panzer.pkgsIdx[pkgName]].def;
        }

        return false;
      }

      // list all package names
      return panzer.pkgs.map(function (pkgCfg) {
        return pkgCfg.name;
      });
    }

    // noOp function used in various places
    function goodForNothinFunction() {}

    // return module namespace
    return {
      // public method to return a Panzer class
      create: function () {
        var
          // platform configuration
          panzer = {
            pkgs: [],
            pkgsIdx: {},
            defs: [],
            KlassProxy: function () {},
            Klass: Klass,
            // shared package-definition method
            // to get next method up the prototype chain
            getSuper: function (methodName) {
              // "this" is the package-definition
              var
                pkgEntryIdx = panzer.defs.indexOf(this),
                pkgEntry,
                pkgInst
              ;
              if (~pkgEntryIdx) {
                pkgEntry = panzer.pkgs[pkgEntryIdx - 1];
                // search prototype from this point in the chain
                if (pkgEntry && methodName && typeof methodName === 'string') {
                  pkgInst = new pkgEntry.proxy();
                  if (typeof pkgInst[methodName] === 'function') {
                    return pkgInst[methodName];
                  }
                }
              }

              // always return a function
              return goodForNothinFunction;
            }
          };

        function Klass(rawtree, klassConfig) {
          var inst = this;
          if (!(inst instanceof Klass)) {
            throw new Error('Missing new operator.');
          }
          // define corresponding privileged instance
          new Tree(panzer, inst, rawtree, typeof klassConfig === 'object' ? klassConfig : {});
        }
        Klass.prototype = panzer.KlassProxy.prototype;

        // Klass package manager
        Klass.pkg = function () {
          return ResolveOrRegisterKlassPackage.apply(panzer, arguments);
        };

        return Klass;
      },
      version: '0.3.13'
    };
  }

  // initialize Panzer, based on the environment
  if (inAMD) {
    define(initPanzer);
  } else if (inCJS) {
    module.exports = initPanzer(require);
  } else if (!scope.Panzer) {
    scope.Panzer = initPanzer();
  }
}(
  typeof define == 'function',
  typeof exports != 'undefined',
  Array, Object, RegExp, this
);
