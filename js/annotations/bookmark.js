/**
 * bookmark.js
 *
 * Part of the annotations tools for Open Journal Systems and other PKP projects
 * Copyright (c) 2009 Michael Joyce <mr.michael.joyce@gmail.com>
 * Distributed under the GNU GPL v2. For full terms see the file docs/COPYING.
 *
 * Bookmark class for annotations
 *
 */

function Bookmark() {
    this.bookmarkId = null;
    this.elementId = null;
    this.type = null;
    this.description = null;

    this.setElementId = function(elementId) {
        this.elementId = elementId;
    }

    this.getElementId = function() {
        return this.elementId;
    }

    this.setType = function(type) {
        this.type = type;
    }
    
    this.getType = function() {
        return this.type;
    }

    this.setDescription = function(description) {
        this.description = description;
    }
    
    this.getDescription = function() {
        return this.description;
    }

    this.applyBookmark = function() {
        var parent = document.getElementById(this.getElementId());
        var bookmark = document.createElement("span");
        bookmark.className = Array("bookmark", this.getType()).join(" ");
        bookmark.id = "annotation_bookmark_" + new Date().getTime();
        bookmark.appendChild(document.createTextNode("X"));
        parent.insertBefore(bookmark, parent.firstChild);
    }
}