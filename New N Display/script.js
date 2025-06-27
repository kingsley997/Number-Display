// Get references to all necessary HTML elements
const numberInput = document.getElementById('number-input');
const addBtn = document.getElementById('add-to-sequence-btn');
const displaySequenceBtn = document.getElementById('display-sequence-btn');
const displayAnswerBtn = document.getElementById('display-answer-btn'); 
const resetBtn = document.getElementById('reset-btn');
const delayInput = document.getElementById('delay-input');
const currentNumberSpan = document.getElementById('current-number');
const answerSpan = document.getElementById('answer');
const answerContainer = document.getElementById('answer-container');
const numberContainer = document.getElementById('number-container');
const sequenceList = document.getElementById('sequence-list');

const answerInput = document.getElementById('answer-input');

// Problem Management Elements
const problemNameInput = document.getElementById('problem-name-input');
const addProblemBtn = document.getElementById('add-problem-btn');
const deleteProblemBtn = document.getElementById('delete-problem-btn');
const problemListContainer = document.getElementById('problem-list-container');

// Hide Sequence Button Elements
const toggleSequenceVisibilityBtn = document.getElementById('toggle-sequence-visibility-btn');
const sequencePreviewContainer = document.querySelector('.sequence-preview-container');

// Hide Answer Button Elements
const toggleAnswerVisibilityBtn = document.getElementById('toggle-answer-visibility-btn');
const answerControlGroup = document.getElementById('answer-control-group');

// Main Display for Fullscreen
const mainDisplay = document.getElementById('main-display');


// --- State Variables ---
// MODIFIED: Added `answerInputHidden` property to each problem
let problems = [];              // Array to hold all problem objects { id, name, sequence:[], answer:'', sequenceHidden: false, answerInputHidden: false }
let activeProblemId = null;     // ID of the currently selected problem
let currentIndex = 0;           // Tracks which item in the current sequence is displayed
let displayInterval;            // Holds the setInterval ID
let isEditing = false;          // Flag for inline editing of sequence items

// Audio Context for sound generation
let audioContext;

// --- Helper Functions ---

/**
 * Generates a unique ID for problems (simple timestamp-based).
 * @returns {string} A unique ID.
 */
function generateUniqueId() {
    return 'q' + Date.now();
}

/**
 * Validates if the input string is a valid number or a recognized arithmetic operator.
 * @param {string} input - The string to validate.
 * @returns {boolean} True if valid, false otherwise.
 */
function isValidSequencePart(input) {
    const trimmedInput = input.trim();
    if (trimmedInput === '') return false;
    if (!isNaN(parseFloat(trimmedInput))) {
        return true;
    }
    const operators = ['+', '-', '*', '/'];
    return operators.includes(trimmedInput);
}

/**
 * Gets the active problem object from the problems array.
 * @returns {object|undefined} The active problem object or undefined if not found.
 */
function getActiveProblem() {
    return problems.find(p => p.id === activeProblemId);
}

/**
 * Saves the current state of the UI (sequence and answer) back into the active problem object.
 * This is crucial before switching problems or adding new ones.
 * MODIFIED: Also saves the `answerInputHidden` state.
 */
function saveActiveProblemState() {
    const activeProblem = getActiveProblem();
    if (activeProblem) {
        activeProblem.name = problemNameInput.value.trim() || `Question ${problems.indexOf(activeProblem) + 1}`;
        activeProblem.sequence = [...numbersSequence]; // Save a copy
        activeProblem.answer = answerInput.value.trim();
        // Save the current hidden state of the sequence preview and answer input
        activeProblem.sequenceHidden = sequencePreviewContainer.classList.contains('hidden-preview');
        activeProblem.answerInputHidden = answerControlGroup.classList.contains('hidden-control-group'); // NEW
    }
}

/**
 * Loads the data from a specified problem into the UI elements.
 * @param {string} problemId - The ID of the problem to load.
 * MODIFIED: Uses updateInputVisibility() to restore visibility states.
 */
function selectProblem(problemId) {
    saveActiveProblemState(); // Save state of the currently active problem before switching

    activeProblemId = problemId;
    const activeProblem = getActiveProblem();

    if (activeProblem) {
        problemNameInput.value = activeProblem.name;
        numbersSequence = [...activeProblem.sequence];
        answerInput.value = activeProblem.answer;
        
        displaySequenceBtn.disabled = numbersSequence.length === 0;
        displayAnswerBtn.disabled = activeProblem.answer.trim() === '';
        
        deleteProblemBtn.disabled = problems.length === 1;

        // NEW: Restore sequence preview and answer input hidden states
        updateInputVisibility();
    } else {
        // Fallback if somehow problemId doesn't exist (shouldn't happen with proper logic)
        resetCurrentProblemUI(); // This will handle updating input visibility for a blank state
        numbersSequence = [];
        displaySequenceBtn.disabled = true;
        displayAnswerBtn.disabled = true;
        deleteProblemBtn.disabled = true;
        // updateInputVisibility() will be called by resetCurrentProblemUI
    }

    updateProblemListUI();
    updateSequencePreview(); // Re-render the visual list
    resetMainDisplayArea(); // Clear main display and exit fullscreen if active
}

/**
 * Adds a new problem set to the problems array and selects it.
 * MODIFIED: Initializes `answerInputHidden` to false for new problems.
 */
function addNewProblem() {
    saveActiveProblemState(); // Save current problem's state before switching

    const newProblem = {
        id: generateUniqueId(),
        name: `Question ${problems.length + 1}`,
        sequence: [],
        answer: '',
        sequenceHidden: false, // New problems start with sequence visible
        answerInputHidden: false // NEW: New problems start with answer input visible
    };
    problems.push(newProblem);

    selectProblem(newProblem.id); // Select the newly created problem
    problemNameInput.focus(); // Focus on the new problem's name input for quick labeling
}

/**
 * Deletes the currently active problem.
 */
function deleteActiveProblem() {
    if (problems.length <= 1) {
        alert("You must have at least one question. To clear this question, use 'Reset Display'.");
        return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete "${getActiveProblem().name}"?`);
    if (!confirmDelete) return;

    const activeIndex = problems.findIndex(p => p.id === activeProblemId);
    problems.splice(activeIndex, 1);

    let newActiveId;
    if (problems.length > 0) {
        newActiveId = problems[Math.min(activeIndex, problems.length - 1)].id;
    } else {
        addNewProblem();
        newActiveId = problems[0].id;
    }

    selectProblem(newActiveId);
}

/**
 * Updates the visual list of problem buttons.
 * Highlights the active problem.
 */
function updateProblemListUI() {
    problemListContainer.innerHTML = '';

    problems.forEach(problem => {
        const problemButton = document.createElement('button');
        problemButton.textContent = problem.name;
        problemButton.classList.add('problem-button');
        if (problem.id === activeProblemId) {
            problemButton.classList.add('active');
        }
        problemButton.addEventListener('click', () => selectProblem(problem.id));
        problemListContainer.appendChild(problemButton);
    });
    deleteProblemBtn.disabled = problems.length === 1;
}

/**
 * Updates the visual list of the current sequence in the dashboard.
 * Each item is rendered with a delete button and made clickable for inline editing.
 */
function updateSequencePreview() {
    sequenceList.innerHTML = '';

    numbersSequence.forEach((part, index) => {
        const listItem = document.createElement('li');
        listItem.setAttribute('data-index', index);

        const partSpan = document.createElement('span');
        partSpan.textContent = part;
        partSpan.classList.add('sequence-item-text');

        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '×';
        deleteBtn.classList.add('delete-item-btn');
        deleteBtn.title = `Remove '${part}'`;
        deleteBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            removeSequenceItem(index);
        });

        listItem.appendChild(partSpan);
        listItem.appendChild(deleteBtn);

        listItem.addEventListener('click', () => {
            if (!isEditing && !displaySequenceBtn.disabled) {
                makeEditable(listItem, index, partSpan);
            }
        });

        sequenceList.appendChild(listItem);
    });

    displaySequenceBtn.disabled = numbersSequence.length === 0;
}

/**
 * Converts a list item's content into an editable input field.
 * Handles saving changes on blur or Enter key.
 */
function makeEditable(listItem, index, partSpan) {
    isEditing = true;
    const originalValue = partSpan.textContent;

    const inputField = document.createElement('input');
    inputField.type = 'text';
    inputField.value = originalValue;
    inputField.className = 'edit-sequence-input';
    inputField.autofocus = true;

    listItem.innerHTML = '';
    listItem.appendChild(inputField);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.classList.add('delete-item-btn');
    deleteBtn.title = `Remove '${originalValue}'`;
    deleteBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        removeSequenceItem(index);
        isEditing = false;
    });
    listItem.appendChild(deleteBtn);

    const saveEdit = () => {
        const newValue = inputField.value.trim();
        if (isValidSequencePart(newValue)) {
            numbersSequence[index] = newValue;
            updateSequencePreview();
        } else {
            alert(`Invalid input: "${newValue}". Please enter a valid number or operator.`);
            numbersSequence[index] = originalValue;
            updateSequencePreview();
        }
        isEditing = false;
    };

    inputField.addEventListener('blur', saveEdit);
    inputField.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            saveEdit();
            event.preventDefault();
            inputField.blur();
        }
    });

    inputField.focus();
}

/**
 * Removes an item from the numbersSequence array and updates the preview list.
 */
function removeSequenceItem(index) {
    numbersSequence.splice(index, 1);
    updateSequencePreview();
    if (numbersSequence.length === 0) {
        displaySequenceBtn.disabled = true;
    }
}

/**
 * Plays a short, high-pitched click/thump sound for number display.
 */
function playNumberDisplaySound() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);

    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.08);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
}

/**
 * Plays a triumphant, ascending chime sound for answer reveal.
 */
function playAnswerRevealSound() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    const baseFrequency = 440;
    const notes = [
        { freq: baseFrequency, time: 0 },
        { freq: baseFrequency * 1.26, time: 0.1 },
        { freq: baseFrequency * 1.5, time: 0.2 }
    ];

    notes.forEach(note => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(note.freq, audioContext.currentTime + note.time);

        gainNode.gain.setValueAtTime(0, audioContext.currentTime + note.time);
        gainNode.gain.linearRampToValueAtTime(0.4, audioContext.currentTime + note.time + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + note.time + 0.4);

        oscillator.start(audioContext.currentTime + note.time);
        oscillator.stop(audioContext.currentTime + note.time + 0.5);
    });
}


/**
 * Displays a number on the main screen with the "Zoom In and Settle" animation.
 */
function showNumber(number) {
    numberContainer.classList.remove('number-visible');
    numberContainer.classList.add('number-hidden');
    currentNumberSpan.textContent = number;
    void numberContainer.offsetWidth;

    playNumberDisplaySound();

    numberContainer.classList.remove('number-hidden');
    numberContainer.classList.add('number-visible');
}

/**
 * Hides the current number display on the main screen by animating it out.
 */
function hideNumber() {
    numberContainer.classList.remove('number-visible');
    numberContainer.classList.add('number-hidden');
}

/**
 * Adds the current input field's value to the active problem's sequence.
 */
function addNumberToSequence() {
    const inputVal = numberInput.value.trim();
    if (!isValidSequencePart(inputVal)) {
        alert("Please enter a valid number or operator (+, -, *, /).");
        return;
    }

    numbersSequence.push(inputVal);
    updateSequencePreview();
    numberInput.value = '';
    numberInput.focus();

    displaySequenceBtn.disabled = false;
    displayAnswerBtn.disabled = answerInput.value.trim() === ''; 
}

/**
 * Enters full-screen mode for the main display.
 */
function enterFullscreen() {
    if (mainDisplay.requestFullscreen) {
        mainDisplay.requestFullscreen();
    } else if (mainDisplay.mozRequestFullScreen) { // Firefox
        mainDisplay.mozRequestFullScreen();
    } else if (mainDisplay.webkitRequestFullscreen) { // Chrome, Safari, Opera
        mainDisplay.webkitRequestFullscreen();
    } else if (mainDisplay.msRequestFullscreen) { // IE/Edge
        mainDisplay.msRequestFullscreen();
    }
}

/**
 * Exits full-screen mode.
 */
function exitFullscreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) { // Firefox
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) { // Chrome, Safari, Opera
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { // IE/Edge
        document.msExitFullscreen();
    }
}

/**
 * Disables all teacher controls.
 */
function disableTeacherControls() {
    numberInput.disabled = true;
    addBtn.disabled = true;
    displaySequenceBtn.disabled = true;
    displayAnswerBtn.disabled = true;
    resetBtn.disabled = true;
    answerInput.disabled = true;
    problemNameInput.disabled = true;
    addProblemBtn.disabled = true;
    deleteProblemBtn.disabled = true;
    problemListContainer.querySelectorAll('button').forEach(btn => btn.disabled = true);
    toggleSequenceVisibilityBtn.disabled = true;
    toggleAnswerVisibilityBtn.disabled = true;
}

/**
 * Enables all teacher controls, adjusting 'display' button based on sequence.
 */
function enableTeacherControls() {
    numberInput.disabled = false;
    addBtn.disabled = false;
    displaySequenceBtn.disabled = numbersSequence.length === 0;
    
    displayAnswerBtn.disabled = answerInput.value.trim() === ''; 

    resetBtn.disabled = false;
    answerInput.disabled = false;
    problemNameInput.disabled = false;
    addProblemBtn.disabled = false;
    deleteProblemBtn.disabled = problems.length === 1;
    problemListContainer.querySelectorAll('button').forEach(btn => btn.disabled = false);
    toggleSequenceVisibilityBtn.disabled = false;
    toggleAnswerVisibilityBtn.disabled = false;
}


/**
 * Initiates the timed display of numbers from the active problem's sequence.
 */
function startDisplaySequence() {
    if (numbersSequence.length === 0) {
        alert("Please add numbers to the sequence first!");
        return;
    }
    if (isEditing) {
        alert("Please finish editing the current item before starting the display.");
        return;
    }
    if (answerInput.value.trim() === '') {
        alert("Please enter the expected answer before starting the display!");
        answerInput.focus();
        return;
    }

    disableTeacherControls();
    enterFullscreen();

    currentIndex = 0;

    answerContainer.classList.add('hidden');
    answerContainer.classList.remove('answer-visible', 'number-visible', 'number-hidden');
    numberContainer.classList.remove('hidden');

    displayInterval = setInterval(() => {
        if (currentIndex < numbersSequence.length) {
            showNumber(numbersSequence[currentIndex]);
            currentIndex++;
        } else {
            clearInterval(displayInterval);
            exitFullscreen();
            enableTeacherControls();
        }
    }, parseInt(delayInput.value) || 2000);
}

/**
 * Displays the final answer on the main display with a dramatic animation.
 */
function displayAnswer() {
    const teacherAnswer = answerInput.value.trim();
    if (teacherAnswer === '') {
        alert("There's no answer entered to display!");
        answerInput.focus();
        return;
    }

    hideNumber();
    displayAnswerBtn.disabled = true; 

    answerSpan.textContent = teacherAnswer;
    answerContainer.classList.remove('hidden');

    playAnswerRevealSound();

    answerContainer.classList.remove('number-hidden', 'number-visible');
    answerContainer.classList.add('answer-visible');
}

/**
 * NEW HELPER: Applies the stored visibility states of sequence preview and answer input to the UI.
 */
function updateInputVisibility() {
    const activeProblem = getActiveProblem();
    if (!activeProblem) return;

    // Handle sequence preview visibility
    if (activeProblem.sequenceHidden) {
        sequencePreviewContainer.classList.add('hidden-preview');
        toggleSequenceVisibilityBtn.textContent = 'Show Sequence Preview';
    } else {
        sequencePreviewContainer.classList.remove('hidden-preview');
        toggleSequenceVisibilityBtn.textContent = 'Hide Sequence Preview';
    }

    // Handle answer input visibility
    if (activeProblem.answerInputHidden) {
        answerControlGroup.classList.add('hidden-control-group');
        toggleAnswerVisibilityBtn.textContent = 'Show Answer Input';
    } else {
        answerControlGroup.classList.remove('hidden-control-group');
        toggleAnswerVisibilityBtn.textContent = 'Hide Answer Input';
    }
}


/**
 * Toggles the visibility of the sequence preview section in the dashboard.
 * MODIFIED: Updates `activeProblem.sequenceHidden` and calls `updateInputVisibility()`.
 */
function toggleSequenceVisibility() {
    const activeProblem = getActiveProblem();
    if (!activeProblem) return;

    // Toggle the state in the problem object first
    activeProblem.sequenceHidden = !activeProblem.sequenceHidden;
    // Then update the UI based on the new state
    updateInputVisibility();
}

// REMOVED `showSequencePreview()` and `hideSequencePreview()` as their logic is now in `updateInputVisibility()` and `toggleSequenceVisibility()` handles state.


/**
 * Toggles the visibility of the answer input section in the dashboard.
 * MODIFIED: Updates `activeProblem.answerInputHidden` and calls `updateInputVisibility()`.
 */
function toggleAnswerVisibility() {
    const activeProblem = getActiveProblem();
    if (!activeProblem) return;

    // Toggle the state in the problem object first
    activeProblem.answerInputHidden = !activeProblem.answerInputHidden;
    // Then update the UI based on the new state
    updateInputVisibility();
}

// REMOVED `showAnswerInput()` as its logic is now in `updateInputVisibility()` and `toggleAnswerVisibility()` handles state.


/**
 * Resets the display area only (numbers and answer) and clears current sequence/answer inputs.
 * Does NOT delete the current problem.
 * MODIFIED: Uses updateInputVisibility() to restore visibility states.
 */
function resetCurrentProblemUI() {
    clearInterval(displayInterval);
    exitFullscreen();

    currentNumberSpan.textContent = '';
    answerSpan.textContent = '';

    numberContainer.classList.remove('number-visible');
    numberContainer.classList.add('number-hidden');
    
    answerContainer.classList.remove('answer-visible');
    answerContainer.classList.remove('number-visible');
    answerContainer.classList.add('number-hidden');

    setTimeout(() => {
        numberContainer.classList.add('hidden');
        answerContainer.classList.add('hidden');
        numberContainer.classList.remove('number-visible', 'number-hidden');
        answerContainer.classList.remove('number-visible', 'number-hidden', 'answer-visible');
    }, 400);

    enableTeacherControls(); // Re-enable all controls (which will update displayAnswerBtn based on answerInput)
    
    numbersSequence = []; // Clear for current problem
    currentIndex = 0;
    isEditing = false;
    
    updateSequencePreview();
    numberInput.focus();
    // NEW: Restore input visibility based on current problem's stored state
    updateInputVisibility(); 
}

/**
 * Resets only the main display area (hides numbers/answer).
 * Used when switching problems or preparing for a new display.
 */
function resetMainDisplayArea() {
    clearInterval(displayInterval);
    exitFullscreen();

    currentNumberSpan.textContent = '';
    answerSpan.textContent = '';

    numberContainer.classList.add('hidden');
    numberContainer.classList.remove('number-visible', 'number-hidden');
    
    answerContainer.classList.add('hidden');
    answerContainer.classList.remove('answer-visible', 'number-visible', 'number-hidden');
    
    enableTeacherControls();
}

/**
 * Handles fullscreen change events (e.g., when user presses ESC).
 * Re-enables teacher controls if fullscreen is exited.
 */
function handleFullscreenChange() {
    if (!document.fullscreenElement &&
        !document.webkitFullscreenElement &&
        !document.mozFullScreenElement &&
        !document.msFullscreenElement) {
        clearInterval(displayInterval);
        enableTeacherControls();
        hideNumber();
        answerContainer.classList.add('hidden');
    }
}


// --- Initial Setup ---

/**
 * Initializes the application state when the page loads.
 * Creates a default problem if none exist.
 */
function initializeProblems() {
    if (problems.length === 0) {
        addNewProblem(); // This will create the first problem and select it
    } else {
        selectProblem(problems[0].id); // Select the first problem if problems exist
    }
    updateProblemListUI();
    // updateInputVisibility() is called within selectProblem and addNewProblem
}


// --- Event Listeners ---

addBtn.addEventListener('click', addNumberToSequence);
numberInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addNumberToSequence();
    }
});

displaySequenceBtn.addEventListener('click', startDisplaySequence);

displayAnswerBtn.addEventListener('click', displayAnswer);

resetBtn.addEventListener('click', resetCurrentProblemUI);

addProblemBtn.addEventListener('click', addNewProblem);
deleteProblemBtn.addEventListener('click', deleteActiveProblem);

problemNameInput.addEventListener('blur', saveActiveProblemState);
problemNameInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        saveActiveProblemState();
        problemNameInput.blur();
    }
});

toggleSequenceVisibilityBtn.addEventListener('click', toggleSequenceVisibility);
toggleAnswerVisibilityBtn.addEventListener('click', toggleAnswerVisibility);

// Listener for input changes in the answer field to enable/disable the Display Answer button
answerInput.addEventListener('input', () => {
    displayAnswerBtn.disabled = answerInput.value.trim() === '';
    // Hide the displayed answer if the input changes after it was shown
    if (!answerContainer.classList.contains('hidden') && answerSpan.textContent !== answerInput.value.trim()) {
        answerContainer.classList.add('hidden');
    }
});


// Fullscreen change event listeners
document.addEventListener('fullscreenchange', handleFullscreenChange);
document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
document.addEventListener('mozfullscreenchange', handleFullscreenChange);
document.addEventListener('MSFullscreenChange', handleFullscreenChange);


// --- Initial App Load ---
initializeProblems();