/**
 * @file Button.tsx
 * @description
 * Reusable circular button component used in the Moodle Data Analyzer extension popup interface.
 * It accepts optional styling, label text, an element ID, and a click event handler.
 *
 * The button is styled with Tailwind CSS classes to appear as a prominent orange circular button
 * with hover effects, shadow, and responsive scaling animation. Commonly used for "Start" or "Restart"
 * actions in the analysis workflow.
 *
 * @component
 * @param {string} [style] - Additional Tailwind CSS classes to customize the button appearance.
 * @param {string} [text] - The label text displayed inside the button.
 * @param {string} [id] - Optional ID to assign to the button element.
 * @param {() => void} [onClick] - Function to execute when the button is clicked.
 *
 * @returns {JSX.Element} A styled button element.
 *
 * @example
 * <Button
 *   id="startButton"
 *   text="Start"
 *   onClick={handleStart}
 * />
 */
type ButtonProps = {
    style?: string;
    text?: string;
    id?: string;
    onClick?: () => void;
};

export default function Button({style, text, id, onClick}: ButtonProps) {
    return (
        <button
            id={id}
            type="button"
            onClick={onClick}
            className={`w-[140px] h-[140px] text-[18px] bg-gradient-to-br from-orange-500 to-orange-400 text-white rounded-full font-bold transition-transform duration-300 hover:scale-110 shadow-xl hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-orange-300 ${style}`}
        >
            {text}
        </button>
    );
}
