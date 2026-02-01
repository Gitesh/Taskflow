---
description: Plan to handle inline tag editing in Taskflow
---

# Feature: Inline Tag Editing

## Objective
When a user edits a task's title or description, existing tags should appear as inline text (e.g., `#urgent`) so they can be modified or removed. When saving, these tags should be extracted, stored in the `tags` array, and removed from the display text to keep the view clean.

## Implementation Steps

### 1. Modify `clkCardEditTitleOrDetail` in `javascript/taskflow.js`
**Current Behavior:** Sets `contenteditable="true"` on the title and description elements.
**New Behavior:**
1.  Identify the task object using `cardID` (derived from the index).
2.  Convert the `task.tags` array into a string format: `"#tag1 #tag2"`.
3.  Append this string to the `editDetail` element (Task Description).
    *   *Note*: Ensure a leading space is added if the description is not empty.
    *   *Decision*: We will append all tags to the **Description** field by default to avoid cluttering the title, unless the user explicitly moves them to the title during editing.

### 2. Modify `saveAndExit` (Internal function) in `javascript/taskflow.js`
**Current Behavior:** Reads `innerHTML`, saves to `data`, and calls `extractTagsFromText` (which only extracts, doesn't clean).
**New Behavior:**
1.  Get the raw text from `editTitle` and `editDetail`.
2.  **Extract Tags**: Use the existing `extractTagsFromText` logic (or a regex) to identify all tags in both fields.
3.  **Clean Text**: Remove the tag strings (e.g., `#tag`) from both the Title and Description strings.
    *   Use regex: `/#[a-z0-9_-]+/gi` -> replace with `""`.
    *   Trim extra whitespace: `.replace(/\s\s+/g, ' ').trim()`.
4.  **Update Data**:
    *   Set `data[cardID].title` = Cleaned Title.
    *   Set `data[cardID].description` = Cleaned Description.
    *   Set `data[cardID].tags` = Extracted Tags (ensure uniqueness).
5.  Restore `contenteditable="false"` and re-render (`createPost`).

### 3. Modify `discardAndExit` (Internal function) in `javascript/taskflow.js`
**Current Behavior:** Reverts `innerHTML` to `originalTitle` and `originalDetail`.
**New Behavior:**
*   No major logic change needed, but ensure that the "appended tags" added in Step 1 are NOT saved. The current `discardAndExit` restores `originalTitle` (which was captured *before* we appended tags? check this).
*   *Validation*: We must capture `originalDetail` *before* we modify the DOM to add the `#tags`.
    *   **Crucial Step**: In `clkCardEditTitleOrDetail`, move the "Appdend Tags" logic *after* `originalDetail` is captured.

## Code Adjustments

### `clkCardEditTitleOrDetail`
```javascript
// ... existing variables ...
const originalTitle = editTitle.innerHTML;
const originalDetail = editDetail.innerHTML;

// START CHANGE
const task = data[cardID];
if (task.tags && task.tags.length > 0) {
    const tagString = task.tags.map(t => '#' + t).join(' ');
    // Append to detail (visibly)
    // Use textContent or innerText to treat as text, but we are editing HTML. 
    // Simply appending text is safe for simple tags.
    if (editDetail.innerHTML.length > 0) {
         editDetail.innerHTML += ' ' + tagString;
    } else {
         editDetail.innerHTML = tagString;
    }
}
// END CHANGE

// ... enable contenteditable ...
```

### `saveAndExit`
```javascript
// ... get text ...
let rawTitle = editTitle.innerText; // Use innerText to get clean text
let rawDetail = editDetail.innerText;

// Extract
const combinedText = rawTitle + " " + rawDetail;
const newTags = extractTagsFromText(combinedText);

// Clean
const cleanTitle = rawTitle.replace(/#[a-z0-9_-]+/gi, '').replace(/\s\s+/g, ' ').trim();
const cleanDetail = rawDetail.replace(/#[a-z0-9_-]+/gi, '').replace(/\s\s+/g, ' ').trim();

// Update Data
data[cardID].title = cleanTitle;
data[cardID].description = cleanDetail;
data[cardID].tags = newTags;

// ... save and render ...
```

## Considerations
*   **Drag & Drop**: Ensure that editing doesn't interfere with draggable attributes (edit mode usually disables dragging or is ignored).
*   **Tag Validity**: The regex `#[a-z0-9_-]+` assumes lowercase. `extractTagsFromText` usually lowers case. We should ensure the "inline" text reflects the actual tag (which might be lowercase).
*   **Empty Descriptions**: If a task has no description but has tags, they will appear in the description box. This is desired behavior.

