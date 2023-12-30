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


export const parseEntity = (text: string): string | number | undefined => {
    if (text.match(/^\d+$/)) {
        return Number(text);
    } else if (text.match(/^@/)) {
        return text.replace(/^@/, "");
    } else {
        return undefined;
    }
}