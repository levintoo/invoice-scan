import type { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(props: ImgHTMLAttributes<HTMLImageElement>) {
    const { className = '', alt = 'App icon', ...rest } = props;
    const classes = className || 'h-9 w-9';

    return (
        <img
            src="/icons/rounded.png"
            alt={alt}
            className={classes}
            {...rest}
        />
    );
}
