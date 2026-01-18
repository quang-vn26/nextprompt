import { Options, OptionSet } from "../promptions-llm";

export type OptionRenderer = React.FC<{
    options: Options;
    set: (option: Options) => void;
    disabled?: boolean;
}>;

export interface VisualOptionSet<T extends Options> extends OptionSet<T> {
    getComponent: () => OptionRenderer;
}
