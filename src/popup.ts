//import './tailwind.css';
// popup.ts
// This script runs when the popup is opened and handles UI interactions.

document.addEventListener('DOMContentLoaded', () => {
    // Get a reference to the analysis button
    const analyzeButton = document.getElementById('analyzeButton') as HTMLButtonElement | null;

    // Get a reference to the output container
    const output = document.getElementById('output') as HTMLDivElement | null;
    const spinner = document.getElementById('spinner') as HTMLDivElement | null;

    if (!analyzeButton || !output || !spinner) {
        console.error('Required elements not found.');
        return;
    }

    // Add a click event listener to the button
    analyzeButton.addEventListener('click', () => {
        analyzeButton.classList.add('hidden'); // Hide the button
        spinner.classList.remove('hidden'); // Show the spinner

        // Simulate async work (e.g., fetching data, scraping)
        setTimeout(() => {
            spinner.classList.add('hidden'); // Hide the spinner

            // Show result (replace with graph rendering later)
            output.textContent = 'Graphs are ready (This is just a placeholder).';
        }, 3000); // Simulate 3 seconds of work
        //
    });
});
