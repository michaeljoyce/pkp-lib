/**
 * controls.js
 *
 * Copyright (c) 2000-2009 John Willinsky
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * Annotation controls for user interaction
 *
 * $ID$
 */

/**
 * Apply a user's annotations to the current HTML page. The lemmas are stored
 * as an XML DOM tree in var data
 *
 * Requres jQuery.
 */
function applyUserAnnotations(data, textStatus) {
  //first show the list of annotations
  $("#annotation_content").html(data.getElementById("annotation_data").innerHTML);
  //now the annotation content is populated. Make it have some hover fun.
  $("#annotation_content dt").hover(
    function() {
      $("span." + $(this).attr("class")).addClass("highlight_hover");
    },
    function() {
      $("span." + $(this).attr("class")).removeClass("highlight_hover")
    }
    );
  //now apply the highlights to the page.
  var range = document.createRange();//create an empty range
  var lemmas = data.getElementsByTagName("lemma");
  for(var i = 0; i < lemmas.length; i++) {
      // only apply the highlights to the correct galley.
      // galleys and abstracts can be annotated - same articleID, different galleyID
    if(lemmas[i].getAttribute("galleyId") == annotations_config.galley_id) {
      var lemma = new Lemma(range);// create an empty lemma
      //    // mangle the lemma into place.
      lemma.lemmaFromDB(
        lemmas[i].getAttribute("startContainer"),
        lemmas[i].getAttribute("startOffset"),
        lemmas[i].getAttribute("endContainer"),
        lemmas[i].getAttribute("endOffset"));
      lemma.setID(lemmas[i].getAttribute("id"));
      var highlight = new Highlight(lemma);
      highlight.apply(lemmas[i].getAttribute("lemmaType"));
    }
  }
}

/**
 * Callback function, called when a user creates a highlight in a document.
 * the lemma that was saved is stored in parameter data as an XML DOM structure.
 * Applies the highlight to the page, after the lemma has been saved.
 * uses jQuery
 */
function saveUserLemmaResult(data, textStatus) {
  //first add the annotation to the list of annotations
  $("#annotation_list").append(data.getElementById("annotation_list").innerHTML);
  //now the annotation content is populated. Make it have some hover fun.
  $("#annotation_content dt:last").hover(
    function() {
      $("span." + $(this).attr("class")).addClass("highlight_hover");
    },
    function() {
      $("span." + $(this).attr("class")).removeClass("highlight_hover")
    }
    );
  //now apply the highlight to the page.
  var range = document.createRange();
  var lemma = new Lemma(range);
  var lemmaData = data.getElementsByTagName("lemma")[0];
  lemma.lemmaFromDB(
    lemmaData.getAttribute("startContainer"),
    lemmaData.getAttribute("startOffset"),
    lemmaData.getAttribute("endContainer"),
    lemmaData.getAttribute("endOffset")
    );
  lemma.setID(lemmaData.getAttribute("id"));
  var highlight = new Highlight(lemma);
  highlight.apply(lemmaData.getAttribute("lemmaType"));
}

/**
 * helper function to compute the total length of all text
 * node children of a node.
 */
function childTextLengths(node) {
  if(node.nodeType == 3) {
      // this is a text node -- no children. Return the
      // text length of the node
    return node.nodeValue.length;
  }
  var length = 0;
  for(var i = 0; i < node.childNodes.length; i++) {
    length += childTextLengths(node.childNodes[i]);
  }
  return length;
}

/**
 * find the non-highlight ancestor of parameter node which contains the offset,
 * starting from node
 * returns an array of the parent node and the updated offset from the parent node.
 */
var ANNOTATION_CLASS = "annotation_lemma";
var highlightRE = new RegExp("\\b" + ANNOTATION_CLASS + "\\b");
function findParent(node, offset) {
  var parent = null;
  var sibling = null;
  if(node.parentNode.tagName == 'SPAN' &&
    node.parentNode.className.match(highlightRE)) {
    //this node is inside a highlight.
    parent = node.parentNode.parentNode;
    sibling = node.parentNode;
  } else {
    parent = node.parentNode;
    sibling = node;
  }
  while((sibling = sibling.previousSibling) != null) {
    offset += childTextLengths(sibling);
  }
  return new Array(parent, offset);
}

/**
 * Convert a DOM range object to something suitable for the database to store.
 * uses findParent to make sure that the parent container is not inside a highlight.
 */
function rangeToDB(range) {
  //find the parent annotatable node (no saving annotations to span.highlights)
  //then find the offset.
  var start = findParent(range.startContainer, range.startOffset);
  var end = findParent(range.endContainer, range.endOffset);
  return new Array(start[0], start[1], end[0], end[1]);
}

/**
 * save a DOM range object and annotation style to the database to create a highlight
 * uses jQuery's ajax functions and saveUserLemmaResult as a call back function
 */
function saveUserLemma(range, style) {
  var r = rangeToDB(range);

  var data = {
    galleyId: annotations_config.galley_id,
    startContainer: r[0].getAttribute("id"),
    startOffset: r[1],
    endContainer: r[2].getAttribute("id"),
    endOffset: r[3],
    lemmaType: style,
    textContent: (range.collapsed ? "" : range.toString())
  }
  $.post(annotations_config.saveLemma, data, saveUserLemmaResult);
}

/**
 * make sure the range only covers documents in the div[@id='content'] element
 * in the document. We don't want to highlight the surrounding controls,
 * data, etc.
 */
function checkEndPoints(range) {
  var n = commonAncestor(range.startContainer, range.endContainer);
  var content = document.getElementById("content");
  while(n.nodeType != 9) {
    //n is not the document node
    if(n == content) {
      return true;
    }
    // walk up the DOM tree, hoping that we are in div[@id='content']
    n = n.parentNode;
  }
  return false;
}

/**
 * Create a new lemma by grabbing a DOM range object, making sure it isn't
 * collapsed into an empty range, making sure it covers ONLY annotatable
 * content, and then saving it by AJAX.
 */
function newUserLemma(style) {
  var range = getRangeObject();
  if( (! range.collapsed) && (checkEndPoints(range))) {
    saveUserLemma(range, style);
  } else {
    alert("Cannot turn your selection into a lemma.");
  }
  return true;
}

/**
 * jQuery bit to get everything going. Assign ID attributes to nodes that don't have them, 
 * grab the lemmas by ajax and apply them to the document.
 */
$(document).ready(function() {
  assignIDAttributes();
  $.get(annotations_config.getLemmas, null, applyUserAnnotations);
//$.get(annotations_config.getBookmarks, null, applyUserBookmarks);
});