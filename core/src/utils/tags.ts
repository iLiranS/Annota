export function generateRandomHexColor(): string {
    // Generate a random number between 0 and 0xFFFFFF (16777215)
    const randomColor = Math.floor(Math.random() * 0xFFFFFF);

    // Convert to a hexadecimal string and pad with zeros to ensure 6 characters
    let hexColor = randomColor.toString(16).padStart(6, '0');

    // Prepend the '#' symbol to form a valid CSS hex color code
    return `#${hexColor}`;
}