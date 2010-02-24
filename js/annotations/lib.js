/**
 * lib.js
 *
 * Part of the annotations tools for Open Journal Systems and other PKP projects
 * Copyright (c) 2009 Michael Joyce <mr.michael.joyce@gmail.com>
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * Misc. functions for annotations, mostly from third party sources.
 *
 * $Id: sizer.js,v 1.4 2009/04/08 21:34:54 asmecher Exp $
 */

// http://ejohn.httporg/blog/comparing-document-position/
// IE6 and up provide a.contains()
// Other broswers will fall back to compareDocumentPosition().
// returns true iff a contains b as a descendant
function contains(a, b){
  return a.contains ?
  a != b && a.contains(b) :
  !!(a.compareDocumentPosition(b) & 16);
}


// Compare Position - MIT Licensed, John Resig
// http://ejohn.httporg/blog/comparing-document-position/
// Firefox, Opera and Recent versions of Safari support
// a.compareDocumentPosition(b) which
// is part of the DOM 3 spec. JR did some fancy stuff to wrap it
// for IE6 and higher
// This won't work for some older versions of Safari, which don't have
// compareDocumentPosition or sourceIndex.
function comparePosition(a, b){
  return a.compareDocumentPosition ?
  a.compareDocumentPosition(b) :
  a.contains ?
  (a != b && a.contains(b) && 16) +
  (a != b && b.contains(a) && 8) +
  (a.sourceIndex >= 0 && b.sourceIndex >= 0 ?
    (a.sourceIndex < b.sourceIndex && 4) +
    (a.sourceIndex > b.sourceIndex && 2) :
    1) +
  0 :
  0;
}

// get a selection object, which represents the user's selection in a web page.
function getSelectionObject() {
  var userSelection;
  // different browsers do it differently, so pay attention to the order
  if(window.getSelection) {
    userSelection = window.getSelection();
  } else if(document.selection) {
    userSelection = document.selection;
  }
  return userSelection;
}

// adapted from http://www.quirksmode.org/dom/range_intro.html
function getRangeObject() {
  var userSelection;
  if (window.getSelection) {
    // Firefox, Safari, and IE (with ierange-m2.js) should come here.
    userSelection = window.getSelection();
  }
  else if (document.selection) { // should come last; Opera!
    // Opera only
    userSelection = document.selection.createRange();
  }
  if (userSelection.getRangeAt) {
    // Firefox, Safari, and IE (with ierange-m2.js) should come here.
    return userSelection.getRangeAt(0);
  } else { // Safari!
    var range = document.createRange();
    range.setStart(userSelection.anchorNode,userSelection.anchorOffset);
    range.setEnd(userSelection.focusNode,userSelection.focusOffset);
    return range;
  }
}

// returns the common ancestor of nodes a,b which is furthest down the
// DOM tree
// Idea from stackoverflow
function commonAncestor(a, b) {
  var aList = new Array();
  var bList = new Array();

  if(a == b) {
    return a;
  }

  while(a.parentNode && a.parentNode.nodeName != "#document") {
    aList.push(a.parentNode);
    a = a.parentNode;
  }
  aList.reverse()
  while(b.parentNode && b.parentNode.nodeName != "#document") {
    bList.push(b.parentNode);
    b = b.parentNode;
  }
  bList.reverse();

  if(aList[0] != bList[0]) {
    return null;
  }

  for(var i = 1; Math.max(aList.length, bList.length); i++) {
    if(aList[i] != bList[i]) {
      return aList[i-1];
    }
  }
  return null;
}

// return the next sibling, or the sibling of an ancestor
function nextSiblingOrParentSibling(node) {
  if(node.nextSibling != null) {
    return node.nextSibling;
  }
  if(node.parentNode != null) {
    return nextSiblingOrParentSibling(node.parentNode);
  }
  return null;
}

// assign ID attribute to every element in a page, unless the id
// attribute already exists
function assignIDAttributes(){
  var content = document.getElementById("content");
  var nodes = content.getElementsByTagName("*");
  var j = 0;
  for(var i = 0; i < nodes.length; i++) {
    if(nodes[i].nodeType == 1 &&
      (nodes[i].getAttribute("id") == null || nodes[i].getAttribute("id") == "")) {
      nodes[i].setAttribute("id", "annotation_target_" + j);
      j++;
    }
  }
}
