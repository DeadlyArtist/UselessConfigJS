class USEC {
    static parse(string, { pedantic = true, variables = null, keepVariables = false, debugTokens = false, debugParser = false } = {}) {
        let tokenizer = new this.Tokenizer(string, { pedantic, debug: debugTokens });
        tokenizer.tokenize();
        if (tokenizer.errors.length != 0) return null;
        return new this.Parser(tokenizer.tokens, { pedantic, variables, keepVariables, compact: tokenizer.compact, debug: debugParser }).parse();
    }

    static toString(object, { readable = false, enableVariables = false } = {}) {
        if (object === undefined) return (readable ? '' : '%') + "!";
        let parts = ["", ""];
        let string = this._toString(object, { readable, enableVariables, indentLevel: 0 });
        parts.push(string);
        if (!readable) parts[0] = "%";
        if (typeof string === 'object') parts[2] = string.value;
        else parts[1] = "!";
        return parts.join("");
    }

    static equals(obj1, obj2) {
        return USEC.toString(obj1) === USEC.toString(obj2);
    }

    static _getIndent(indentLevel, readable) {
        return readable ? '  '.repeat(indentLevel) : '';
    }

    static _getPrevIndent(indentLevel, readable) {
        return this._getIndent(Math.max(0, indentLevel - 1), readable);
    }

    static _string_toString(object) {
        let string = object.replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t')
            .replace(/\n/g, '\\n');
        return '"' + string + '"';
    }

    static _toString(object, { readable = false, enableVariables = false, indentLevel = 0 } = {}) {
        const indent = this._getIndent(indentLevel, readable);
        const prevIndent = this._getPrevIndent(indentLevel, readable);
        const newline = readable ? '\n' : ',';
        const maybeNewline = readable ? newline : "";
        const space = readable ? ' ' : '';

        if (object instanceof USEC.Format) {

        }

        if (object === undefined) return null;
        if (object === null) return 'null';
        if (object === true) return 'true';
        if (object === false) return 'false';

        if (typeof object === 'number') {
            return String(object);
        }

        if (typeof object === 'string') {
            if (enableVariables) {
                const regex = /^\$\(\$([a-zA-Z_][a-zA-Z0-9_]*)\)$/;
                const match = object.match(regex);
                if (match) return match[1];
            }
            return this._string_toString(object);
        }

        if (object?.toUSECString) {
            return (object.noIndent ? '' : indent) + object.toUSECString({ readable, enableVariables, indentLevel });
        }

        if (object?.toJSON) {
            return USEC._toString(object.toJSON(), { readable, enableVariables, indentLevel });
        }

        if (Array.isArray(object)) {
            if (object.length === 0) return '[]';
            const items = object.map(item => {
                item = USEC._toString(item, { readable, enableVariables, indentLevel: indentLevel + 1 });
                if (item === null) return null;
                return indent + item;
            }).filter(item => item !== null);
            if (items.length === 0) return '[]';
            return '[' + maybeNewline + items.join(newline) + maybeNewline + prevIndent + ']';
        }

        if (typeof object === 'object') {
            const entries = Object.entries(object);
            if (entries.length === 0) return '{}';

            const body = entries.map(([key, value]) => {
                value = USEC._toString(value, { readable, enableVariables, indentLevel: indentLevel + 1 });
                if (value === null) return null;

                let outputKey = key;
                let declaration = false;

                if (enableVariables) {
                    if (outputKey.startsWith('\\$')) {
                        outputKey = outputKey.slice(1); // remove escape backslash
                    } else if (outputKey.startsWith('\\\\')) {
                        outputKey = outputKey.slice(1); // remove escape backslash
                    } else if (outputKey.startsWith('$')) {
                        outputKey = outputKey.slice(1);
                        declaration = true;
                    }
                }

                // Validate outputKey for identifier usage
                const isIdentifier = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(outputKey);
                if (!isIdentifier && declaration) throw new Error("Invalid variable key: " + outputKey);
                const encodedKey = isIdentifier ? outputKey : this._string_toString(outputKey);
                const prefix = declaration ? ':' : '';

                return indent + prefix + encodedKey + space + '=' + space + value;
            }).filter(item => item !== null);
            if (body.length === 0) return '{}';

            if (indentLevel == 0) return { value: body.join(newline) };
            return '{' + maybeNewline + body.join(newline) + maybeNewline + prevIndent + '}';
        }

        throw new Error(`Unsupported type: ${typeof object}`);
    }

    static Format = class Format {
        constructor(node, { before = [], after = [] } = {}) {
            this.node = node;
            this.before = before;
            this.after = after;
        }

        toUSECString({ readable = false, enableVariables = false, indentLevel = 0 } = {}) {
            const main = USEC._toString(object.node, { readable, enableVariables, indentLevel });
            if (!readable) return main;

            const indent = USEC._getIndent(indentLevel, readable);
            const strParts = [];

            for (const el of object.before) {
                if (el.noIndent) {
                    strParts.push(USEC.toString(el, { readable, enableVariables, indentLevel }));
                } else {
                    strParts.push(indent + USEC.toString(el, { readable, enableVariables, indentLevel }));
                }
            }

            strParts.push(main);

            for (const el of object.after) {
                if (el.noIndent) {
                    strParts.push(USEC.toString(el, { readable, enableVariables, indentLevel }));
                } else {
                    strParts.push(indent + USEC.toString(el, { readable, enableVariables, indentLevel }));
                }
            }

            return strParts.join(newline);
        }
    };

    static Newline = class Newline {
        noIndent = true;
        constructor(count = 1) {
            this.count = count;
        }

        toUSECString(options) {
            return "\n";
        }
    };

    static Comment = class Comment {
        constructor(value = "") {
            this.value = value;
        }

        toUSECString(options) {
            return `# ${this.value}`;
        }
    };

    static MultilineComment = class MultilineComment {
        constructor(value = "") {
            this.value = value;
        }

        toUSECString(options) {
            return `%%\n${this.value}\n%%`;
        }
    };

    static MultilineString = class MultilineString {
        constructor(value = "") {
            this.value = value;
        }

        toUSECString(options) {
            let string = object.replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\r/g, '\\r')
                .replace(/\t/g, '\\t');
            return '`\n' + string + '\n`';
        }
    };


    static Tokenizer = class {
        string = "";
        index = 0;
        line = 1;
        col = 1;
        tokens = [];
        openerStack = [];
        errors = [];
        keywords = new Set(["true", "false", "null"]);
        compact = false;

        get current() {
            return this.string[this.index];
        }

        get eof() {
            return this.index >= this.string.length;
        }

        get lastToken() {
            return this.tokens.length == 0 ? null : this.tokens[this.tokens.length - 1];
        }

        get lastOpener() {
            return this.openerStack.length == 0 ? null : this.openerStack[this.openerStack.length - 1];
        }

        constructor(string, { pedantic = true, debug = false } = {}) {
            this.string = string;
            this.pedantic = pedantic;
            this.debug = debug;
        }

        init() {
            if (this.string.startsWith("%")) {
                this.compact = true;
                this.next();
            }
        }

        tokenize() {
            this.init();
            this.addToken(this.makeToken("newline", "sof"));
            let earlyEnd = this.eof;
            while (!this.eof) {
                this.readStatement();
            }
            if (!earlyEnd && (this.lastToken?.type == "space" || this.lastToken?.type == "newline")) this.tokens.pop();
            this.addToken(this.makeToken("newline", "eof"));
            if (this.openerStack.length != 0) {
                for (let token of this.openerStack) this.error_token("Unclosed opener", token);
            }
            return this.tokens;
        }

        // === Token helpers ===
        makeToken(type, value, col = undefined, line = undefined) {
            return {
                type,
                value,
                line: line ?? this.line,
                col: col ?? this.col,
            };
        }

        getInverted(char) {
            const by = {
                "$(": ")",
                ")": "$(",
                "{": "}",
                "}": "{",
                "[": "]",
                "]": "[",
                "\"": "\"",
                "\`": "\`",
            }
            return by[char];
        }

        next() {
            if (this.current === "\n") {
                this.line++;
                this.col = 1;
            } else {
                this.col++;
            }
            this.index++;
        }

        peek(offset = 1) {
            return this.index + offset >= this.string.length ? "" : this.string[this.index + offset];
        }

        addToken(token) {
            this.tokens.push(token);
            if (this.debug) this.printToken(token);
        }

        addOpener(token) {
            this.addToken(token);
            this.openerStack.push(token);
        }

        addCloser(token) {
            this.addToken(token);
            const lo = this.lastOpener;
            if (lo && lo.value == this.getInverted(token.value)) {
                this.openerStack.pop();
            } else this.error_token("Unopened closer", token);
        }

        addNewline(ch) {
            const lt = this.lastToken;
            if (lt) {
                if (lt.type == "space") {
                    if (this.compact) this.error_token("Unnecessary space", lt);
                    this.replaceLast(this.makeToken("newline", ch));
                } else if (lt.type == "newline") {
                    if (this.compact) this.error("Unnecessary newline");
                } else this.addToken(this.makeToken("newline", ch));
            }
        }

        replaceLast(token) {
            this.tokens.pop();
            this.tokens.push(token);
        }

        isLetter(ch) {
            return /[a-zA-Z_]/.test(ch);
        }

        isStartIdentifierChar(ch) {
            return /[a-zA-Z_]/.test(ch);
        }

        isIdentifierChar(ch) {
            return /[a-zA-Z0-9_]/.test(ch);
        }

        readStatement() {
            const ch = this.current;
            const pk = this.peek();
            const lt = this.lastToken;
            const lo = this.lastOpener;

            if (this.isStartIdentifierChar(ch)) {
                this.readIdentifierOrKeyword()
            } else if (ch === "#") {
                if (this.compact) this.error("Comments are not allowed in compact mode");
                this.readComment();
            } else if (ch === "%" && pk === "%") {
                if (this.compact) this.error("Comments are not allowed in compact mode");
                this.readMultilineComment();
            } else if (ch === "!") {
                this.addToken(this.makeToken("exclamation", ch));
                this.next();
            } else if (ch === ":") {
                this.addToken(this.makeToken("colon", ch));
                this.next();
            } else if (ch === "=") {
                this.addToken(this.makeToken("equals", ch));
                this.next();
            } else if (ch === "[") {
                this.addOpener(this.makeToken("array_open", ch));
                this.next();
            } else if (ch === "]") {
                this.addCloser(this.makeToken("array_close", ch));
                this.next();
            } else if (ch === "{") {
                this.addOpener(this.makeToken("brace_open", ch));
                this.next();
            } else if (ch === "}") {
                this.addCloser(this.makeToken("brace_close", ch));
                this.next();
            } else if (ch === "'") {
                this.readChar()
            } else if (ch === '"') {
                this.readString();
            } else if (ch === "`") {
                this.readMultilineString();
            } else if (ch >= "0" && ch <= "9" || ch === "-") {
                this.readNumber()
            } else if (ch === " ") {
                if (lt && lt.type != "space" && lt.type != "newline") this.addToken(this.makeToken("space", ch));
                else if (this.compact) this.error("Unnecessary space");
                this.next();
            } else if (ch === ",") {
                if (!this.compact && pk != "" && pk != ' ' && pk != '\n' && pk != '\r') this.error("Missing whitespace after comma");
                if (!lt || lt.type == "space" || lt.type == "newline") this.error("Invalid comma");
                this.addNewline(ch);
                this.next();
            } else if (ch === "\n") {
                this.addNewline(ch);
                this.next();
            } else if (ch === "\r" && pk === "\n") {
                this.addNewline(ch + pk);
                this.next();
                this.next();
            } else {
                this.error(`Unexpected character '${ch}'`);
                this.next();
            }
        }

        readComment() {
            while (!this.eof && this.current !== "\n") {
                this.next();
            }
        }

        readMultilineComment() {
            this.next();
            this.next();
            while (!this.eof) {
                if (this.current === "%" && this.peek() === "%") {
                    this.next();
                    this.next();
                    break;
                }
                this.next();
            }
        }

        readInterpolation() {
            // $(
            this.next();
            this.next();
            const start = this.index;
            const startCol = this.col;
            while (!this.eof && this.isIdentifierChar(this.current)) {
                this.next();
            }
            if (this.current === ")") {
                this.addToken(this.makeToken("identifier", this.string.slice(start, this.index), startCol));
                this.next();
            } else {
                this.error("Invalid interpolation character");
            }
        }

        readIdentifierOrKeyword() {
            const start = this.index;
            const startCol = this.col;
            while (!this.eof && this.isIdentifierChar(this.current)) {
                this.next();
            }

            const value = this.string.slice(start, this.index);
            if (this.keywords.has(value)) return this.makeToken("keyword", value);
            this.addToken(this.makeToken("identifier", value, startCol));
        }

        readChar() {
            const startCol = this.col;
            let value = "";
            this.next(); // skip initial '

            if (this.current === "\\") {
                this.next();
                value = this.escapeChar(this.current);
            } else if (this.current === "\'") {
                this.index--;
            } else {
                value = this.current;
            }
            this.next();

            if (this.current !== "'") {
                this.error(`Missing closing single quote after character literal`);
            } else {
                this.next(); // skip closing '
            }

            if (value.length !== 1) {
                this.error(`Character literal must be a single character`);
            }

            this.addToken(this.makeToken("char", value, startCol));
        }

        readString() {
            this.addOpener(this.makeToken("string_start", this.current));
            this.next();

            let startCol = this.col;
            let startLine = this.line;
            let str = "";
            const addStringPart = () => {
                if (str.length === 0) return;
                this.addToken(this.makeToken("string", str, startCol, startLine));
            }

            while (!this.eof) {
                const ch = this.current;

                if (ch === '"') {
                    addStringPart();
                    this.addCloser(this.makeToken("string_end", ch));
                    this.next();
                    break;
                } else if (ch === "$" && this.peek() == "(") {
                    addStringPart();
                    this.readInterpolation();
                } else if (ch === "\n") {
                    addStringPart();
                    this.error("Unclosed string");
                    this.openerStack.pop();
                    this.next();
                    break;
                } else if (ch === "\\") {
                    this.next();
                    str += this.escapeChar(this.current);
                    this.next();
                    continue;
                } else {
                    str += ch;
                    this.next();
                    continue;
                }

                str = "";
                startCol = this.col;
                startLine = this.line;
            }
        }

        readMultilineString() {
            this.addOpener(this.makeToken("string_start", this.current));
            this.next();

            let startCol = this.col;
            let startLine = this.line;
            let str = "";
            const addStringPart = () => {
                if (str.length === 0) return;
                this.addToken(this.makeToken("string", str, startCol, startLine));
            }

            if (this.string[this.index - 1] == "`" && this.current == "\n") this.next();

            while (!this.eof) {
                const ch = this.current;

                if (ch === "`") {
                    addStringPart();
                    this.addCloser(this.makeToken("string_end", ch));
                    this.next();
                    break;
                } else if (ch === "$" && this.peek() == "(") {
                    addStringPart();
                    this.readInterpolation();
                } else if (ch === "\n" && this.peek() === "`") {
                    // skip adding the last newline
                    this.next();
                    continue;
                } else if (ch === "\\") {
                    this.next();
                    str += this.escapeChar(this.current);
                    this.next();
                    continue;
                } else {
                    str += ch;
                    this.next();
                    continue;
                }

                str = "";
                startCol = this.col;
                startLine = this.line;
            }
        }

        readNumber() {
            const start = this.index;
            const startCol = this.col;
            let dotSeen = false;
            let digitSeen = false;

            if (this.current == "-") {
                this.next();
            }

            while (!this.eof) {
                const ch = this.current;

                if ((ch >= "0" && ch <= "9")) {
                    digitSeen = true;
                    this.next();
                } else if (ch === "." && !dotSeen) {
                    dotSeen = true;
                    this.next();
                } else {
                    break;
                }
            }

            const raw = this.string.slice(start, this.index);
            const num = parseFloat(raw);

            if (!digitSeen || isNaN(num)) {
                this.error(`Invalid number: '${raw}'`);
            }

            this.addToken(this.makeToken("number", num, startCol));
        }

        escapeChar(ch) {
            const map = {
                n: "\n",
                r: "\r",
                t: "\t",
                '"': '"',
                "'": "'",
                "\\": "\\",
            };
            return map[ch] ?? ch;
        }

        printToken(token) {
            console.log(`${token.line}:${token.col} [${token.type}]`, typeof token.value == "string" ? token.value.replace('\n', "\\n").replace('\r\n', "\\r\\n").replace('\t', "\\t") : token.value);
        }

        error(message) {
            const err = new Error(`[Line ${this.line}, Col ${this.col}] ${message}`);
            if (this.pedantic) throw err;
            this.errors.push(err);
        }

        error_token(message, token) {
            const err = new Error(`[Line ${token.line}, Col ${token.col}] ${message}`);
            if (this.pedantic) throw err;
            this.errors.push(err);
        }
    };

    static Parser = class Parser {
        tokens = [];
        index = 1; // start after sof
        indent = 0;

        constructor(tokens, { pedantic = true, variables = null, keepVariables = false, compact = false, debug = false } = {}) {
            this.tokens = tokens;
            this.pedantic = pedantic;
            this.keepVariables = keepVariables;
            this.compact = compact;
            this.debug = debug;
            this.variables = variables ?? {};
        }

        get current() {
            return this.tokens[this.index];
        }

        get peek() {
            return this.tokens[this.index + 1];
        }

        get eof() {
            return this.index + 1 >= this.tokens.length;
        }

        parse(variables) {
            variables ??= this.variables;
            if (this.current.type == "exclamation") {
                this.next();
                if (this.eof) return undefined;
                return this.parseValue(variables);
            } return this.parseFile(variables);
        }

        next() {
            this.index++;
        }

        optional(type) {
            if (!this.eof && this.current.type === type) {
                const token = this.current;
                this.next();
                return token;
            }
            return null;
        }

        check(type) {
            return !this.eof && this.current.type === type;
        }

        expect(type) {
            let check = this.check(type);
            if (!check) {
                if (this.eof) this.error(`Unexpected end, expected ${type}`);
                else this.error(`Expected ${type}, got ${this.current.type}`);
            }
            return check;
        }

        cons_ret(type) {
            if (this.expect(type)) this.next();
            else if (this.check("newline")) return true;
            return false;
        }

        parseStatement(variables) {
            if (this.check("colon")) {
                return this.parseDeclaration(variables);
            } else {
                return this.parseAssignment(variables);
            }
        }

        parseDeclaration(variables) {
            this.next();
            if (!this.expect("identifier") && this.check("newline")) {
                if (this.check("newline")) return null;
            }
            let key = this.current.value;
            this.next();

            if (!this.compact) if (this.cons_ret("space")) return null;
            if (this.cons_ret("equals")) return null;
            if (!this.compact) if (this.cons_ret("space")) return null;

            let value = this.parseValue(variables);
            if (value == null) return null;

            return { type: "declaration", key, value };
        }

        parseAssignment(variables) {
            if (!this.check("identifier") && !this.check("string_start")) {
                this.error(`Expected assignment or declaration`);
                if (this.check("newline")) return null;
            }
            let key = this.check("identifier") ? this.current.value : this.parseString();
            this.next();

            if (!this.compact) if (this.cons_ret("space")) return null;
            if (this.cons_ret("equals")) return null;
            if (!this.compact) if (this.cons_ret("space")) return null;

            let value = this.parseValue(variables);
            if (value == null) return null;

            return { type: "assignment", key, value };
        }

        parseValue(variables) {
            const token = this.current;
            const line = token.line;
            const col = token.col;

            let result;
            switch (token.type) {
                case "keyword":
                    this.next();
                    switch (token.value) {
                        case "true": result = true; break;
                        case "false": result = false; break;
                        case "null": result = null; break;
                        default: result = token.value;
                    }
                    break;

                case "number":
                    this.next();
                    result = token.value;
                    break;

                case "string_start":
                    result = this.parseString(variables);
                    break;
                case "char":
                    this.next();
                    result = token.value;
                    break;

                case "identifier":
                    result = this.keepVariables ? `$($${this.parseVariable(variables)})` : this.parseVariable(variables);
                    break;

                case "array_open":
                    result = this.parseArray(variables);
                    break;

                case "brace_open":
                    result = this.parseObject(variables);
                    break;

                default:
                    this.error(`Unexpected value token: ${token.type}`);
            }

            if (this.debug) this.printNode(result, line, col);
            return result;
        }

        parseVariable(variables) {
            const token = this.current;
            this.next(); // consume identifier

            const name = token.value;
            if (!(name in variables)) {
                this.error(`Undefined variable '${name}'`);
                return null; // fallback
            }

            if (this.keepVariables) return name;
            return variables[name]; // resolve directly
        }

        parseString(variables) {
            this.next(); // consume string_start

            let result = "";

            while (!this.eof) {
                const token = this.current;

                if (token.type === "string") {
                    result += token.value;
                    this.next();
                } else if (token.type === "identifier") {
                    if (this.keepVariables) result += `$(${this.parseVariable(variables)})`;
                    else result += this.parseVariable(variables);
                } else if (token.type === "string_end") {
                    this.next();
                    break;
                } else {
                    this.error(`Unexpected token in string: ${token.type}`);
                    this.next();
                }
            }

            return result;
        }

        parseArray(variables) {
            this.next(); // consume array_open
            const array = [];

            if (this.check("newline")) {
                if (this.compact) this.error("Unnecessary newline");
                this.next();
            }
            while (!this.check("array_close")) { // no eof guaranteed by tokenizer
                const value = this.parseValue(variables);
                array.push(value);

                if (this.check("newline")) {
                    if (this.peek.type == "array_close" && this.compact) this.error("Unnecessary newline");
                    this.next();
                } else this.expect("array_close");
            }

            this.next(); // consume array_close
            return array;
        }

        parseFile(variables) {
            const obj = {};

            if (this.check("newline")) {
                this.next();
            }
            while (!this.eof) {
                const stmt = this.parseStatement(variables);
                if (this.debug) console.log(`[Node]`, stmt);
                if (stmt && stmt.key !== null) {
                    if (stmt.type == "declaration") {
                        variables[stmt.key] = stmt.value;
                        if (this.keepVariables) obj["$" + stmt.key] = stmt.value;
                    } else if (stmt.type == "assignment") {
                        if (stmt.key in obj) this.error("Duplicate object key");
                        obj[stmt.key] = stmt.value;
                    }
                }

                if (!this.eof) this.expect("newline");
                this.next();
            }

            return obj;
        }

        parseObject(variables) {
            this.next(); // consume brace_open
            const obj = {};
            variables = { ...variables };
            this.indent += 2;

            if (this.check("newline")) {
                if (this.compact) this.error("Unnecessary newline");
                this.next();
            }
            while (!this.check("brace_close")) { // no eof guaranteed by tokenizer
                const line = this.current.line;
                const col = this.current.col;
                const stmt = this.parseStatement(variables);
                if (this.debug) this.printNode(stmt, line, col);
                if (stmt && stmt.key !== null) {
                    if (stmt.type == "declaration") {
                        variables[stmt.key] = stmt.value;
                        if (this.keepVariables) obj["$" + stmt.key] = stmt.value;
                    } else if (stmt.type == "assignment") {
                        if (stmt.key in obj) this.error("Duplicate object key");
                        obj[stmt.key] = stmt.value;
                    }
                }

                if (this.check("newline")) {
                    if (this.peek.type == "brace_close" && this.compact) this.error("Unnecessary newline");
                    this.next();
                } else this.expect("brace_close");
            }

            this.next(); // consume brace_close
            return obj;
        }

        printNode(node, line, col) {
            console.log(" ".repeat(this.indent) + `${line}:${col} [Node]`, node);
        }

        error(msg) {
            const token = this.current;
            const where = ` [Line ${token.line}, Col ${token.col}]`;
            const err = new Error(`${msg}${where}`);
            if (this.pedantic) throw err;
            else console.warn(err.message);
        }
    };
}