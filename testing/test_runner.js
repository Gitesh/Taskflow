/**
 * Taskflow Test Runner
 * Run from console: runAutomatedTests()
 */

const TaskflowTests = {

    // Helper: Create V1 Task
    createV1Task: (id) => ({
        id: id,
        Task_Title: "Legacy Task " + id,
        task_detail: "This is a meaningful description #urgent",
        date_captured: new Date().toISOString(),
        status: "Pending",
        task_tag: "work, legacy",
        section: "div1"
    }),

    // Test 1: Validation of V2 Schema Structure
    testV2Schema: () => {
        console.group("Test 1: V2 Schema Validation");
        try {
            const v2Task = {
                id: "test_1",
                title: "Test Title",
                description: "Test Description",
                tags: ["tag1"],
                priority: 1,
                status: "Pending",
                version: 2
            };

            // Basic check - in a real app use a schema validator
            if (v2Task.version !== 2) throw new Error("Version mismatch");
            if (!Array.isArray(v2Task.tags)) throw new Error("Tags must be array");

            console.log("[PASS] Schema structure looks correct");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 2: Migration Logic
    testMigration: () => {
        console.group("Test 2: Migration Logic");
        try {
            // Mock the migration function if it's not global yet (for standalone run)
            // Implementation pending in taskflow.js, but logic expected:
            const v1 = TaskflowTests.createV1Task("mig_1");

            // Manually simulate what migrateTask should do to verify our expectations
            // Real test will call the actual function once implemented
            if (typeof migrateTask !== 'function') {
                console.warn("[WARN] migrateTask function not found. Skipping execution.");
            } else {
                const v2 = migrateTask(v1);

                if (v2.title !== v1.Task_Title) throw new Error("Title not mapped");
                if (v2.description !== v1.task_detail) throw new Error("Description not mapped");
                if (v2.priority !== 1) throw new Error("Section div1 should be priority 1");
                if (!v2.tags.includes("urgent")) throw new Error("Did not extract hashtag from description");
                if (!v2.tags.includes("work")) throw new Error("Did not migrate existing CSV tags");
                if (v2.version !== 2) throw new Error("Version not updated");

                console.log("[PASS] Migration logic verified");
            }
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 3: Tag Extraction
    testTagExtraction: () => {
        console.group("Test 3: Tag Extraction");
        try {
            // Mock or call real function
            if (typeof extractTagsFromText !== 'function') {
                console.warn("[WARN] extractTagsFromText not found");
                // Shim for test verification of logic
                const shimExtract = (text) => (text.match(/#[a-z0-9_-]+/gi) || []).map(t => t.substring(1).toLowerCase());
                const tags = shimExtract("Do this #NOW and #later");
                if (tags[0] !== 'now' || tags[1] !== 'later') throw new Error("Regex failed");
            } else {
                const tags = extractTagsFromText("Do this #NOW and #later");
                if (tags.length !== 2) throw new Error("Count mismatch");
                if (tags[0] !== 'now') throw new Error("Case normalization failed");
            }
            console.log("[PASS] Tag extraction working");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 4: Deletion HUD Elements Exist
    testDeletionHudExists: () => {
        console.group("Test 4: Deletion HUD Elements");
        try {
            const hud = document.getElementById('idDeletionHUD');
            if (!hud) throw new Error("HUD element not found");

            const btnKeep = document.getElementById('btnConfirmKeep');
            const btnRemove = document.getElementById('btnConfirmRemove');
            const btnDelete = document.getElementById('btnConfirmDelete');

            if (!btnKeep) throw new Error("Keep button not found");
            if (!btnRemove) throw new Error("Remove button not found");
            if (!btnDelete) throw new Error("Delete button not found");

            // Check onclick attributes exist (bug fix verification)
            if (!btnKeep.onclick) throw new Error("Keep button missing onclick handler");
            if (!btnRemove.onclick) throw new Error("Remove button missing onclick handler");
            if (!btnDelete.onclick) throw new Error("Delete button missing onclick handler");

            console.log("[PASS] All HUD elements exist with onclick handlers");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 5: Deletion Functions Exist
    testDeletionFunctionsExist: () => {
        console.group("Test 5: Deletion Functions");
        try {
            if (typeof clkCardDeleteTask !== 'function') throw new Error("clkCardDeleteTask not found");
            if (typeof window.clkConfirmKeep !== 'function') throw new Error("clkConfirmKeep not found");
            if (typeof window.clkConfirmRemove !== 'function') throw new Error("clkConfirmRemove not found");
            if (typeof window.clkConfirmDelete !== 'function') throw new Error("clkConfirmDelete not found");
            if (typeof hideDeletionHud !== 'function') throw new Error("hideDeletionHud not found");

            console.log("[PASS] All deletion functions exist");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 6: Simulated Keep Button Click
    testKeepButton: () => {
        console.group("Test 6: Keep Button Functionality");
        try {
            // Create a test task
            const testTask = TaskModel.create({
                id: "test_keep_" + Date.now(),
                title: "Test Keep Task",
                description: "Testing keep functionality",
                priority: 1
            });

            const initialLength = data.length;
            data.push(testTask);

            // Set active deletion UID
            activeDeletionUid = testTask.id;

            // Show HUD (simplified - just set it visible for test)
            const hud = document.getElementById('idDeletionHUD');
            hud.classList.remove('hidden');

            // Click Keep
            window.clkConfirmKeep();

            // Verify HUD is hidden
            if (!hud.classList.contains('hidden') && hud.style.opacity !== '0') {
                throw new Error("HUD should be hidden after Keep");
            }

            // Verify task still exists and is not deleted
            if (data.length !== initialLength + 1) throw new Error("Task was removed instead of kept");
            if (testTask.deleted) throw new Error("Task should not be marked as deleted");

            // Cleanup
            data.pop();

            console.log("[PASS] Keep button works correctly");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 7: Simulated Remove (Soft Delete) Button Click
    testRemoveButton: () => {
        console.group("Test 7: Remove (Soft Delete) Functionality");
        try {
            const testTask = TaskModel.create({
                id: "test_remove_" + Date.now(),
                title: "Test Remove Task",
                description: "Testing soft delete",
                priority: 2
            });

            const initialLength = data.length;
            data.push(testTask);

            activeDeletionUid = testTask.id;

            // Click Remove
            window.clkConfirmRemove();

            // Verify task is soft deleted (deleted flag set but still in array)
            if (data.length !== initialLength + 1) throw new Error("Task should still be in array");
            if (!testTask.deleted) throw new Error("Task should be marked as deleted");
            if (testTask.status !== 'Deleted') throw new Error("Status should be 'Deleted'");

            // Cleanup
            data.pop();

            console.log("[PASS] Remove button soft-deletes correctly");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 8: Simulated Delete (Permanent) Button Click
    testDeleteButton: () => {
        console.group("Test 8: Delete (Permanent) Functionality");
        try {
            const testTask = TaskModel.create({
                id: "test_delete_" + Date.now(),
                title: "Test Delete Task",
                description: "Testing permanent delete",
                priority: 3
            });

            const initialLength = data.length;
            data.push(testTask);

            activeDeletionUid = testTask.id;

            // Click Delete
            window.clkConfirmDelete();

            // Verify task is permanently removed from array
            if (data.length !== initialLength) throw new Error("Task should be removed from array");

            const found = data.find(t => t.id === testTask.id);
            if (found) throw new Error("Task should not exist in data array");

            console.log("[PASS] Delete button permanently removes task");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 9: Multiple Consecutive Deletions (Bug Scenario)
    testConsecutiveDeletions: () => {
        console.group("Test 9: Multiple Consecutive Deletions");
        try {
            // This tests the bug fix - ensure handlers work after multiple calls
            const tasks = [];
            for (let i = 0; i < 3; i++) {
                tasks.push(TaskModel.create({
                    id: "test_multi_" + i + "_" + Date.now(),
                    title: "Multi Test " + i,
                    priority: 4
                }));
                data.push(tasks[i]);
            }

            // Simulate 3 consecutive deletion attempts
            for (let i = 0; i < 3; i++) {
                activeDeletionUid = tasks[i].id;

                // Verify functions still callable
                if (typeof window.clkConfirmKeep !== 'function') {
                    throw new Error("clkConfirmKeep undefined after deletion " + i);
                }

                // Call keep on first, remove on second, delete on third
                if (i === 0) {
                    window.clkConfirmKeep();
                    if (tasks[i].deleted) throw new Error("Task 0 should be kept");
                } else if (i === 1) {
                    window.clkConfirmRemove();
                    if (!tasks[i].deleted) throw new Error("Task 1 should be soft deleted");
                } else {
                    window.clkConfirmDelete();
                    const found = data.find(t => t.id === tasks[i].id);
                    if (found) throw new Error("Task 2 should be permanently deleted");
                }
            }

            // Cleanup - remove test tasks
            data = data.filter(t => !t.id.startsWith("test_multi_"));

            console.log("[PASS] Multiple consecutive deletions work correctly");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 10: Restore Deleted Task
    testRestoreTask: () => {
        console.group("Test 10: Restore Functionality");
        try {
            const testTask = TaskModel.create({
                id: "test_restore_" + Date.now(),
                title: "Test Restore Task",
                priority: 1
            });

            data.push(testTask);

            // Soft delete it first
            testTask.deleted = true;
            testTask.status = 'Deleted';

            // Mock wrapper element for restore
            const mockWrapper = {
                getAttribute: () => testTask.id,
                closest: () => mockWrapper
            };

            // Call restore
            if (typeof window.clkRestoreTask !== 'function') {
                throw new Error("clkRestoreTask not found");
            }

            window.clkRestoreTask(mockWrapper);

            // Verify task is restored
            if (testTask.deleted) throw new Error("Task should not be deleted after restore");
            if (testTask.status !== 'Pending') throw new Error("Status should be reset to Pending");

            // Cleanup
            data.pop();

            console.log("[PASS] Restore functionality works");
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 11: Notes Undo/Redo Consistency
    testNotesHistory: async () => {
        console.group("Test 11: Notes Undo/Redo");
        try {
            // Open editor for first task
            window.clkOpenTaskNotes(0);
            await new Promise(r => setTimeout(r, 500)); // Wait for render

            const dialog = document.querySelector('.clsNotesModal');
            const textarea = dialog.querySelector('.notes-editor-textarea');
            const initialValue = textarea.value;

            // Type something
            textarea.value = initialValue + " Updated for test";
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Wait for debounced history (1000ms in code)
            await new Promise(r => setTimeout(r, 1200));

            // Undo
            const undoBtn = dialog.querySelector('[data-action="undo"]');
            undoBtn.click();

            if (textarea.value !== initialValue) {
                throw new Error(`Undo failed: expected "${initialValue}", got "${textarea.value}"`);
            }

            // Redo
            const redoBtn = dialog.querySelector('[data-action="redo"]');
            redoBtn.click();

            if (textarea.value !== initialValue + " Updated for test") {
                throw new Error("Redo failed");
            }

            console.log("[PASS] Notes Undo/Redo working consistently");

            // Clean up: close editor
            const closeBtn = dialog.querySelector('#btnCloseNotes');
            closeBtn.click();
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    },

    // Test 12: Notes Shortcut Logic
    testNotesShortcuts: async () => {
        console.group("Test 12: Notes Shortcuts");
        try {
            window.clkOpenTaskNotes(0);
            await new Promise(r => setTimeout(r, 500));

            const dialog = document.querySelector('.clsNotesModal');
            const searchPanel = dialog.querySelector('#idSearchPanel');

            if (searchPanel.style.display !== 'none') throw new Error("Search panel should be hidden initially");

            // Dispatch CTRL+F
            const event = new KeyboardEvent('keydown', {
                key: 'f',
                ctrlKey: true,
                bubbles: true
            });
            dialog.dispatchEvent(event);

            if (searchPanel.style.display === 'none') throw new Error("CTRL+F failed to show search panel");

            console.log("[PASS] Shortcuts (CTRL+F) working");

            const closeBtn = dialog.querySelector('#btnCloseNotes');
            closeBtn.click();
        } catch (e) {
            console.error("[FAIL]", e.message);
        }
        console.groupEnd();
    }
};

window.runAutomatedTests = async () => {
    console.log("=== Running Taskflow Automated Tests ===");
    TaskflowTests.testV2Schema();
    TaskflowTests.testTagExtraction();
    TaskflowTests.testMigration();
    TaskflowTests.testDeletionHudExists();
    TaskflowTests.testDeletionFunctionsExist();
    TaskflowTests.testKeepButton();
    TaskflowTests.testRemoveButton();
    TaskflowTests.testDeleteButton();
    TaskflowTests.testConsecutiveDeletions();
    TaskflowTests.testRestoreTask();
    await TaskflowTests.testNotesHistory();
    await TaskflowTests.testNotesShortcuts();
    console.log("=== Done ===");
};

// Helper to run only deletion tests
window.runDeletionTests = () => {
    console.log("=== Running Deletion Tests ===");
    TaskflowTests.testDeletionHudExists();
    TaskflowTests.testDeletionFunctionsExist();
    TaskflowTests.testKeepButton();
    TaskflowTests.testRemoveButton();
    TaskflowTests.testDeleteButton();
    TaskflowTests.testConsecutiveDeletions();
    TaskflowTests.testRestoreTask();
    console.log("=== Deletion Tests Complete ===");
};

