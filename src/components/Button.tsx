/**
 * @file Button.tsx
 * @description
 * Reusable circular button component used in the Moodle Data Analyzer extension popup interface.
 * Styled with Tailwind CSS and supports custom class names, IDs, labels, and click events.
 *
 * @component
 * @param {string} className - Additional Tailwind classes.
 * @param {string} text - Button label.
 * @param {string} [id] - Optional button ID.
 * @param {() => void} [onClick] - Click handler.
 *
 * @example
 * <Button text="Start" onClick={handleClick} />
 */

type ButtonProps = {
    className?: string;
    text: string;
    id?: string;
    onClick?: () => void;
};

export default function Button({className = "", text, id, onClick}: ButtonProps) {
    return (
        <button
            id={id}
            type="button"
            onClick={onClick}
            className={`w-[140px] h-[140px] text-[18px] bg-gradient-to-br from-orange-500 to-orange-400 
            text-white rounded-full font-bold transition-transform duration-300 hover:scale-110 shadow-xl 
            hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-orange-300 ${className}`}
            aria-label={text}
            title={text}
        >
            {text}
        </button>
    );
}
