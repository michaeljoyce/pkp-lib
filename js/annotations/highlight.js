/**
 * highlight.js
 *
 * Copyright (c) 2000-2009 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * Highlighting class for annotations
 *
 * $Id$
 */

function Highlight(lemma) {
  this.ANNOTATION_CLASS = "annotation_lemma";

  this.lemma = lemma;
  this.nodes = new Array();
  this.id = lemma.getID();

  this.whiteSpaceRE = new RegExp("\\S+");
  this.highlightRE = new RegExp("\\b" + this.ANNOTATION_CLASS + "\\b");

  // Add a node to the list of nodes in this highlight.
  // only text nodes get added. All other nodes are ignored.
  // TODO: should this add all text-node descendants of an element,
  //       rather than ignoring the element?
  this.addNode = function(node) {
    switch(node.nodeType) {
      case 3:
        this.nodes.push(node);
        break;
      default:
        for(var i = 0; i < node.childNodes.length; i++) {
          this.addNode(node.childNodes[i]);
        }
        break;
    }
  }

  // Once the nodes have been found (and are in this.nodes[]), mangle them to
  // highlight then in the chosen style
  this.applyHighlights = function(style) {
    for(var i = 0; i < this.nodes.length; i++) {
      var node = this.nodes[i];
      if(node.nodeValue.match(this.whiteSpaceRE)) {
        var parent = this.nodes[i].parentNode;
        //nodes[i] contains at least one non-whitespace character.
        if(parent.tagName == "SPAN" &&
          parent.className.match(this.highlightRE)) {
          // this node has already been highlighted at least once.
          // add the highlighting to its parent, which must already
          // be a span.
          parent.className += " " + Array(style, this.id).join(" ");
        } else {
          // this text node hasn't been highlighted before.
          // create a styled span and put it in place.
          var span = document.createElement("span");
          span.className = Array(this.ANNOTATION_CLASS, style, this.id).join(" ");
          if(i == 0) {
              span.id = this.id;
          }
          parent.replaceChild(span, node);
          span.appendChild(node);
        }
      }
    }
  }

  // utility function to test if a node is contained in the highlighted range.
  // This function always returns returns 0, false, or NULL in Internet Explorer
  this.inRange = function(node) {
    return (comparePosition(this.lemma.getRange().startContainer, node) & 4) &&
    (comparePosition(this.lemma.getRange().endContainer, node) & 2);
  }

  // non-IE version of findChildLemmaNodes()
  // Given a node, finds all the descendants and compares their position to the
  // start and end nodes. adds the text nodes in the range.
  this.findChildLemmaNodes = function(node) {
    switch(node.nodeType) {
      case 3: // Node.TEXT_NODE
        if(this.inRange(node))
          this.addNode(node);
        break;
      case 1: // Node.ELEMENT_NODE
        for(var i = 0; i < node.childNodes.length; i++)
          this.findChildLemmaNodes(node.childNodes[i]);
        break;
    }
  }

  // IE specific version of findChildLemmaNodes -- less efficient, but works.
  // note the recursion.
  // NODE must be between the start and end nodes.
  this.findChildLemmaNodesIE = function(node, endNode) {
    if(node == endNode) {
      // we've arrived at the end node. Return true, which propogates
      // up the stack frame and stops all the recursion
      return true;
    }
    switch(node.nodeType) {
      case 3:
        // this is a text node in the range. Add it.
        this.addNode(node);
        break;
      case 1:
        // iterate through the child nodes of this node, and apply the
        // algorithm recursively. If the end node is found, return
        // ie. stop the recursion.
        var children = node.childNodes;
        for(var i = 0; i < children.length; i++)
          if(this.findChildLemmaNodesIE(children[i], endNode))
            return true;
        break;
    }
    // the end node isn't in this branch. Return false, and the system will
    // try the next branch.
    return false;
  }

  // All browsers
  // mangle the beginning of the range, splitting text as necessary
  // TODO: draw some pictures for the documentation to describe what's going on
  this.findLemmaNodesStart = function() {
    var range = this.lemma.getRange();
    var startText = null;
    if(range.startContainer.nodeType != 3) {
      //elementNode to elementNode highlight
      startText = range.startContainer;
    } else {
      startText = range.startContainer.splitText(range.startOffset);
      if(range.startContainer.parentNode.tagName == 'SPAN' &&
        range.startContainer.parentNode.className.match(this.highlightRE)) {
        // the start container is in a highlight span
        var parent = range.startContainer.parentNode; // span.h1
        var grandParent = parent.parentNode;        // p or li, etc
        var span = document.createElement("span");  // new end container
        span.appendChild(startText);
        grandParent.insertBefore(span, parent.nextSibling);
        span.className = parent.className;          // copy class names
        startText.parentNode.className = span.className;
      }
      this.addNode(startText);
    }
    return startText;
  }

  // All browsers
  // mangle the end of the range, splitting text as necessary
  // TODO: draw some pictures for the documentation to describe what's going on
  this.findLemmaNodesEnd = function() {
    var range = this.lemma.getRange();
    var endText = null;
    if(range.endContainer.nodeType != 3) {
      endText = range.endContainer;
      this.addNode(endText);
    } else {
      endText = range.endContainer.splitText(range.endOffset);
      this.addNode(range.endContainer);
      if(range.endContainer.parentNode.tagName == 'SPAN' &&
        range.endContainer.parentNode.className.match(this.highlightRE)) {
        // if the end is inside a highlight span
        var parent = range.endContainer.parentNode; // span.h1
        var grandParent = parent.parentNode;        // p or li, etc
        var span = document.createElement("span");  // new end container
        span.className = parent.className;          // copy class names
        span.appendChild(range.endContainer);       // move endContainer to new span
        grandParent.insertBefore(span, parent);     // insert new span before end node.
      }
    }
    return endText;
  }

  // All browsers
  // This is a simple lemma, the start and end container are the same text node
  // if this simple lemma is inside an already highlighted node, then do
  // lots of fun mangling to make it work.
  this.foundSimpleLemma = function() {
    var range = this.lemma.getRange();
    var parent = range.endContainer;
    var startText = range.endContainer; //splitting it twice will shrink it down to the start text.
    var highlightText = null;
    if(startText.nodeType != 3) {
      highlightText = startText;
    } else {
      var endText = parent.splitText(range.endOffset);
      highlightText = parent.splitText(range.startOffset);
      if(highlightText.parentNode.tagName == 'SPAN' &&
        highlightText.parentNode.className.match(this.highlightRE)) {
        // this is a nested highlight. fancy!
        var parent = highlightText.parentNode;
        var grandParent = parent.parentNode;
        var startSpan = document.createElement("span");
        startSpan.className = parent.className;
        startSpan.appendChild(startText);

        var highlightSpan = document.createElement("span");
        highlightSpan.className = parent.className;
        highlightSpan.appendChild(highlightText);

        var endSpan = document.createElement("span");
        endSpan.className = parent.className;
        endSpan.appendChild(endText);

        grandParent.replaceChild(endSpan, parent);
        grandParent.insertBefore(highlightSpan, endSpan);
        grandParent.insertBefore(startSpan, highlightSpan);
      }
    }
    this.addNode(highlightText);
  }

  // Non-IE
  // Wrapper for findChildLemmaNodes()
  this.findLemmaNodes = function() {
    this.findChildLemmaNodes(this.lemma.getRange().commonAncestorContainer);
  }

  // IE-specific
  // look for the endNode in a branch of the DOM tree, then try the next
  // branch, then the next... until the end node is found.
  this.findLemmaNodesIE = function(startText, endText) {
    var n = nextSiblingOrParentSibling(startText);
    while((n != null) && ( ! this.findChildLemmaNodesIE(n, endText))) {
      // nextSiblingOrParentSibling is defined in lib.js
      n = nextSiblingOrParentSibling(n);
    }
  }

  // All browsers
  // find the text nodes,
  // and span the heck out of them.
  this.apply = function(style) {
    var range = this.lemma.getRange();

    // this isn't a text-node to text node highlight
    // it is a elementNode to elementNode highlight
    // FIXME: shouldn't there be some code here?'
    if(range.startContainer.nodeType != 3) {
          
    }

    if(range.endContainer == range.startContainer) {
      this.foundSimpleLemma();
    } else {
      var endText = this.findLemmaNodesEnd();
      var startText = this.findLemmaNodesStart();
      if(document.all) {
        this.findLemmaNodesIE(startText, endText);
      } else {
        this.findLemmaNodes();
      }
    }
    this.applyHighlights(style);

    return this.id;
  }
}