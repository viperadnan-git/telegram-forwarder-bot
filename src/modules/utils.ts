export const formatObject = (obj: {
    [key: string]: number[] | undefined;
}): string => {
    let text = "";
    for (const key in obj) {
        text += `(${key})\n`;

        if (obj[key] === undefined) {
            text += "\n";
        } else {
            const len = obj[key]?.length ?? 0;
            obj[key]?.forEach((value, index) => {
                index === len - 1
                    ? (text += `└─(${value})\n`)
                    : (text += `├─(${value})\n`);
            });
        }
    }

    return text;
};
