/**
 * lemma.js
 *
 * Part of the annotations tools for Open Journal Systems and other PKP projects
 * Copyright (c) 2009 Michael Joyce <mr.michael.joyce@gmail.com>
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * Lemma class for annotations
 *
 */

function Lemma(range) {
  var TEXT_LEMMA = 1;
  var ELEMENT_LEMMA = 2;

  this.ANNOTATION_CLASS = "annotation_lemma";
  this.highlightRE = new RegExp("\\b" + this.ANNOTATION_CLASS + "\\b");

  this.range = range;
  this.text =  (range.collapsed ? "" : range.toString());
  // range.ToString() is broken on IE.

  this.id = null;

  this.getID = function() {
    return this.id;
  }

  this.setID = function(id) {
    this.id = id;
  }

  this.getRange = function() {
    return this.range;
  };
  this.getText = function() {
    return this.text;
  }

  // given a range from the db, find the start of the range in the DOM, which
  // may be different from the DOM when the range was created.
  this.findNode = function(node, remaining) {
    var seen = 0;
    var r;
    if(node.nodeType == 3) {
      seen = node.nodeValue.length;
      //this is a text node. it has no children.
      if(node.nodeValue.length > remaining) {
        return new Array(node, remaining);
      } else {
        return new Array(null, seen);
      }
    }
    //this is an element node. Look at the children in order
    for(var i = 0; i < node.childNodes.length; i++) {
      r = this.findNode(node.childNodes[i], remaining - seen);
      if(r[0] != null) {
        return r;
      } else {
        seen += r[1];
      }
    }
    return new Array(null, seen);
  }

  // ranges are stored in the DB differently from how they are generated
  // from user interaction.
  this.lemmaFromDB = function(startId, startOffset, endId, endOffset) {
    var startContainer = document.getElementById(startId);
    var endContainer = document.getElementById(endId);
    var result;
    result = this.findNode(startContainer, startOffset);
    this.range.setStart(result[0], result[1]);
    result = this.findNode(endContainer, endOffset);
    this.range.setEnd(result[0], result[1]);
    this.text = this.range.toString();
  }

  // calculate the sum of the text lengths of all descendants of the node.
  this.childTextLengths = function(node) {
    if(node.nodeType == 3) {
      return node.nodeValue.length;
    }
    var length = 0;
    for(var i = 0; i < node.childNodes.length; i++) {
      length += this.childTextLengths(node.childNodes[i]);
    }
    return length;
  }

  // find the node's non-highlight parent. traverse along the DOM tree \
  // until the correct node is found.'
  this.findParent = function(node, offset) {
    var parent = null;
    var sibling = null;
    if(node.parentNode.tagName == 'SPAN' &&
      node.parentNode.className.match(this.highlightRE)) {
      //this node is inside a highlight.
      parent = node.parentNode.parentNode;
      sibling = node.parentNode;
    } else {
      parent = node.parentNode;
      sibling = node;
    }

    while((sibling = sibling.previousSibling) != null) {
      offset += this.childTextLengths(sibling);
    }
    // remove this line  soon.
    return new Array(parent, offset);
  }

  //convert this javascript object into something appropriate for a databse.
  this.lemmaToDB = function() {
    //find the parent annotatable node (no saving annotations to span.highlights)
    //then find the offset.
    var start = null;
    var end = null;
    var start = this.findParent(this.range.startContainer, this.range.startOffset);
    var end = this.findParent(this.range.endContainer, this.range.endOffset);
    return new Array(start[0], start[1], end[0], end[1]);
  }
  return true;
}