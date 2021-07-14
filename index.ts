/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : 星期二 7月 13, 2021 15:02:23 CST
 *
 * @description : index
 *
 ******************************************************************************/

type CompareResult = -1 | 0 | 1;

export class DuplicateError extends Error {
  constructor(path: string) {
    super(`Duplicate trail found '${path}'`);
  }
}

export class SharedKeyError extends Error {
  constructor(current: string, previous: string) {
    super(`Tried to place key '${current}' at same level as '${previous}`);
  }
}

export enum Kind {
  Normal,
  Named,
  Glob,
}

export class Reader {
  readonly _value: string;
  private _position: number;

  constructor(value: string) {
    this._value = value;
    this._position = 0;
  }

  public get hasNext(): boolean {
    return this._position < this._value.length;
  }

  public next(): string {
    return this._value[this._position++];
  }

  public get current(): string {
    return this._value[this._position];
  }

  public get peekNext(): string {
    return this._value[this._position + 1];
  }

  public get position() {
    return this._position;
  }
  public set position(pos) {
    this._position = Math.max(0, Math.min(pos, this._value.length));
  }

  public slice(offset?: number, size?: number) {
    const start: number | undefined = offset;
    let end: number | undefined = undefined;
    if (start !== undefined && size !== undefined) end = start + size;

    return this._value.slice(start, end);
  }
}

export class Node<T> {
  static Kind = Kind;

  private value: {
    placeholder: boolean;
    children: Node<T>[];
    priority: number;
    payload: T | null;
    kind: Kind;
    key: string;
  } = {
    placeholder: false,
    children: [],
    priority: 0,
    payload: null,
    kind: Kind.Normal,
    key: "",
  };

  public get placeholder(): boolean {
    return this.value.placeholder;
  }

  public get payload(): T | null {
    return this.value.payload;
  }
  public set payload(payload) {
    this.value.payload = payload;
  }

  public get key(): string {
    return this.value.key;
  }

  public set key(key) {
    this.value.key = key;
    this.value.kind = Kind.Normal;
    this.value.priority = 0;

    let index = 0;
    while (index < this.key.length) {
      const char = this.key[index];
      if (char === "*") {
        this.value.kind = Kind.Glob;
        break;
      } else if (char === ":") {
        this.value.kind = Kind.Named;
        break;
      } else {
        index++;
      }
    }
    this.value.priority = index;
  }

  public get kind(): Kind {
    return this.value.kind;
  }

  public get children(): Array<Node<T>> {
    return this.value.children;
  }

  /**
   * Returns the priority of the Node based on it's *key*
   *
   * This value will be directly associated to the key size up until a
   * special elements is found.
   *
   * ```
   * Radix::Node(Nil).new("a").priority
   * # => 1
   *
   * Radix::Node(Nil).new("abc").priority
   * # => 3
   *
   * Radix::Node(Nil).new("/src/*filepath").priority
   * # => 5
   *
   * Radix::Node(Nil).new("/search/:query").priority
   * # => 8
   * ```
   */
  get priority(): number {
    return this.value.priority;
  }

  /**
   * Returns `true` if the node key contains a named parameter in it
   *
   * ```
   * node = Radix::Node(Nil).new(":query")
   * node.named? # => true
   *
   * node = Radix::Node(Nil).new("abc")
   * node.named? # => false
   * ```
   */
  get isNamed() {
    return Kind.Named === this.value.kind;
  }

  /**
   * Returns `true` if the node key does not contain an special parameter
   * (named or glob)
   *
   * ```
   * node = Radix::Node(Nil).new("a")
   * node.normal? # => true
   *
   * node = Radix::Node(Nil).new(":query")
   * node.normal? # => false
   * ```
   */
  get isNormal() {
    return Kind.Normal === this.value.kind;
  }

  /**
   * Returns `true` if the node key contains a glob parameter in it
   * (catch all)
   *
   * ```
   * node = Radix::Node(Nil).new("*filepath")
   * node.glob? # => true
   *
   * node = Radix::Node(Nil).new("abc")
   * node.glob? # => false
   * ```
   */
  get isGlob() {
    return Kind.Glob === this.value.kind;
  }

  constructor(key: string, payload: T | null = null, placeholder = false) {
    this.key = key;
    this.value.payload = payload;
    this.value.placeholder = placeholder;
  }

  sort() {
    this.value.children.sort(Node.Comparator);
  }

  static Comparator(left: Node<any>, right: Node<any>): CompareResult {
    if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;

    return left.priority < right.priority
      ? 1
      : left.priority === right.priority
      ? 0
      : -1;
  }

  toJSON(): any {
    return this.value;
  }
}

/**
 # Result present the output of walking our [Radix tree](https://en.wikipedia.org/wiki/Radix_tree)
 # `Radix::Tree` implementation.
 #
 # It provides helpers to retrieve the success (or failure) and the payload
 # obtained from walkin our tree using `Radix::Tree#find`
 #
 # This information can be used to perform actions in case of the *path*
 # that was looked on the Tree was found.
 #
 # A Result is also used recursively by `Radix::Tree#find` when collecting
 # extra information like *params*.
 */
export class Result<T> {
  public readonly params: Record<string, string> = {};

  public get payload(): T | undefined {
    return this._payload;
  }
  private _payload?: T;

  /**
   # Returns whatever a *payload* was found by `Tree#find` and is part of
   # the result.
   #
   # ```
   # result = Radix::Result(Symbol).new
   # result.found?
   # # => false
   #
   # root = Radix::Node(Symbol).new("/", :root)
   # result.use(root)
   # result.found?
   # # => true
   # ```
   */
  get isFound(): boolean {
    return this._payload !== undefined;
  }

  /**
   # Adjust result information by using the details of the given `Node`.
   #
   # * Collect `Node` for future references.
   # * Use *payload* if present.
   */
  use(node: Node<T>, payload = true) {
    if (payload && node.payload) this._payload = node.payload;
  }

  toJSON() {
    return {
      payload: this.payload,
      is_found: this.isFound,
      params: this.params,
    };
  }
}

export class Tree<T> {
  private _root: Node<T> = new Node<T>("", undefined, true);
  get root(): Node<T> {
    return this._root;
  }

  /**
   * Inserts given *path* into the Tree
   *
   * * *path* - An `String` representing the pattern to be inserted.
   * * *payload* - Required associated element for this path.
   *
   * If no previous elements existed in the Tree, this will replace the
   * defined placeholder.
   *
   * ```
   * tree = Radix::Tree(Symbol).new
   *
   * # /         (:root)
   * tree.add "/", :root
   *
   * # /         (:root)
   * # \-abc     (:abc)
   * tree.add "/abc", :abc
   *
   * # /         (:root)
   * # \-abc     (:abc)
   * #     \-xyz (:xyz)
   * tree.add "/abcxyz", :xyz
   * ```
   *
   * Nodes inside the tree will be adjusted to accommodate the different
   * segments of the given *path*.
   *
   * ```
   * tree = Radix::Tree(Symbol).new
   *
   * # / (:root)
   * tree.add "/", :root
   *
   * # /                   (:root)
   * # \-products/:id      (:product)
   * tree.add "/products/:id", :product
   *
   * # /                    (:root)
   * # \-products/
   * #           +-featured (:featured)
   * #           \-:id      (:product)
   * tree.add "/products/featured", :featured
   * ```
   *
   * Catch all (globbing) and named parameters *path* will be located with
   * lower priority against other nodes.
   *
   * ```
   * tree = Radix::Tree(Symbol).new
   *
   * # /           (:root)
   * tree.add "/", :root
   *
   * # /           (:root)
   * # \-*filepath (:all)
   * tree.add "/*filepath", :all
   *
   * # /           (:root)
   * # +-about     (:about)
   * # \-*filepath (:all)
   * tree.add "/about", :about
   * ```
   */
  public add(path: string, payload: T) {
    const root = this._root;
    if (root.placeholder) {
      this._root = new Node<T>(path, payload);
    } else {
      this._add(path, payload, root);
    }
  }

  private _add(path: string, payload: T, node: Node<T>) {
    // move cursor position to last shared character between key and path
    let index = 0;
    for (
      const max = Math.min(path.length, node.key.length);
      index < max;
      index++
    ) {
      if (path[index] !== node.key[index]) break;
    }

    // determine split point difference between path and key
    // compare if path is larger than key
    if (index === 0 || (index < path.length && index >= node.key.length)) {
      // determine if a child of this node contains the remaining part
      // of the path
      let added = false;

      const newKey = path.slice(index);
      for (const child of node.children) {
        if (child.key[0] === ":" && newKey[0] == ":") {
          if (!this.isSameKey(newKey, child.key))
            throw new SharedKeyError(newKey, child.key);
        } else {
          if (child.key[0] !== newKey[0]) continue;
        }

        added = true;
        this._add(newKey, payload, child);
      }

      if (!added) {
        node.children.push(new Node<T>(newKey, payload));
      }

      node.sort();
    } else if (index === path.length && index === node.key.length) {
      // determine if path matches key and potentially be a duplicate
      // and raise if is the case
      if (node.payload) {
        throw new DuplicateError(path);
      } else {
        // assign payload since this is an empty node
        node.payload = payload;
      }
    } else if (index > 0 && index < node.key.length) {
      // # determine if current node key needs to be split to accomodate new
      // # children nodes

      // # build new node with partial key and adjust existing one
      const newKey = node.key.slice(index);
      const swapPayload = node.payload ? node.payload : undefined;

      const newNode = new Node<T>(newKey, swapPayload);
      Array.prototype.push.apply(newNode.children, node.children);

      // # clear payload and children (this is no longer and endpoint)
      node.payload = null;
      node.children.splice(0, node.children.length);

      // adjust existing node key to new partial one
      node.key = path.slice(0, index);
      node.children.push(newNode);
      node.sort();

      // # determine if path still continues
      if (index < path.length) {
        const newKey = path.slice(index);
        node.children.push(new Node<T>(newKey, payload));
        node.sort();

        // clear payload (no endpoint)
        node.payload = null;
      } else {
        // this is an endpoint, set payload
        node.payload = payload;
      }
    }
  }

  /**
   * Returns a `Result` instance after walking the tree looking up for
   * *path*
   *
   * It will start walking the tree from the root node until a matching
   * endpoint is found (or not).
   *
   * ```
   * tree = Radix::Tree(Symbol).new
   * tree.add "/about", :about
   *
   * result = tree.find "/products"
   * result.found?
   * # => false
   *
   * result = tree.find "/about"
   * result.found?
   * # => true
   *
   * result.payload
   * # => :about
   * ```
   */
  public find(path: string): Result<T> {
    const result = new Result<T>();
    const root = this.root;
    // walk the tree from root (first time)
    this._find(path, result, root, true);
    return result;
  }

  private _find(path: string, result: Result<T>, node: Node<T>, first = false) {
    // special consideration when comparing the first node vs. others
    // in case of node key and path being the same, return the node
    // instead of walking character by character
    if (first && path === node.key && node.payload !== null) {
      result.use(node);
      return;
    }

    const keyReader = new Reader(node.key);
    const pathReader = new Reader(path);

    // walk both path and key while both have characters and they continue
    // to match. Consider as special cases named parameters and catch all
    // rules.
    while (
      keyReader.hasNext &&
      pathReader.hasNext &&
      (keyReader.current === "*" ||
        keyReader.current === ":" ||
        pathReader.current === keyReader.current)
    ) {
      switch (keyReader.current) {
        case "*": {
          // deal with catch all (globbing) parameter
          // extract parameter name from key (exclude *) and value from path
          const name = keyReader.slice(keyReader.position + 1);
          const value = pathReader.slice(pathReader.position);
          // add this to result
          result.params[name] = value;
          result.use(node);
          return;
        }
        case ":": {
          // deal with named parameter
          // extract parameter name from key (from : until / or EOL) and
          // value from path (same rules as key)
          const keySize = this.getParamSize(keyReader);
          const pathSize = this.getParamSize(pathReader);

          // obtain key and value using calculated sizes
          // for name: skip ':' by moving one character forward and compensate
          // key size.
          const name = keyReader.slice(keyReader.position + 1, keySize - 1);
          const value = pathReader.slice(pathReader.position, pathSize);
          // add this information to result
          result.params[name] = value;
          // advance readers positions
          keyReader.position += keySize;
          pathReader.position += pathSize;
          break;
        }
        default:
          // move to the next character
          keyReader.next();
          pathReader.next();
      }
    }

    // check if we reached the end of the path & key
    if (!pathReader.hasNext && !keyReader.hasNext) {
      // check endpoint
      if (node.payload !== null) return result.use(node);
    }
    // determine if remaining part of key and path are still the same
    if (
      keyReader.hasNext &&
      pathReader.hasNext &&
      (keyReader.current !== pathReader.current ||
        keyReader.peekNext !== pathReader.peekNext)
    ) {
      // path and key differ, skipping
      return;
    }

    // still path to walk, check for possible trailing slash or children
    // nodes
    if (pathReader.hasNext) {
      // using trailing slash?
      if (
        node.key.length > 0 &&
        pathReader.position + 1 === path.length &&
        pathReader.current === "/"
      ) {
        return result.use(node);
      }

      // not found in current node, check inside children nodes
      const newPath = pathReader.slice(pathReader.position);
      for (const child of node.children) {
        // check if child key is a named parameter, catch all or shares parts
        // with new path
        if (
          child.isGlob ||
          child.isNamed ||
          this.isSharedKey(newPath, child.key)
        ) {
          // traverse branch to determine if valid
          this._find(newPath, result, child);
          if (result.isFound) {
            // stop iterating over nodes
            return;
          } else {
            // move to next child
            continue;
          }
        }
      }
      // path differs from key, no use searching anymore
      return;
    }

    // key still contains characters to walk
    //   if key_reader.has_next?
    if (keyReader.hasNext) {
      // determine if there is just a trailing slash?
      if (
        keyReader.position + 1 === node.key.length &&
        keyReader.current === "/"
      ) {
        return result.use(node);
      }
      // check if remaining part is catch all
      //     if key_reader.pos < node.key.bytesize &&
      //        ((key_reader.current_char == '/' && key_reader.peek_next_char == '*') ||
      //        key_reader.current_char == '*')
      if (
        keyReader.position < node.key.length &&
        ((keyReader.current === "/" && keyReader.peekNext === "*") ||
          keyReader.current === "*")
      ) {
        // skip to '*' only if necessary
        if (keyReader.current !== "*") keyReader.next();
        // deal with catch all, but since there is nothing in the path
        // return parameter as empty
        const name = keyReader.slice(keyReader.position + 1);
        result.params[name] = "";

        return result.use(node);
      }
    }
  }

  /**
   # Internal: Compares *path* against *key* for differences until the
   # following criteria is met:
   #
   # - End of *path* or *key* is reached.
   # - A separator (`/`) is found.
   # - A character between *path* or *key* differs
   #
   # ```
   # _same_key?("foo", "bar")         # => false (mismatch at 1st character)
   # _same_key?("foo/bar", "foo/baz") # => true (only `foo` is compared)
   # _same_key?("zipcode", "zip")     # => false (`zip` is shorter)
   # ```
   */
  private isSameKey(path: string, key: string): boolean {
    let different = false;
    let index = 0;
    while (
      index < path.length &&
      path[index] !== "/" &&
      index < key.length &&
      key[index] !== "/"
    ) {
      if (path[index] !== key[index]) {
        different = true;
        break;
      }
      index++;
    }

    return !different && (path[index] === "/" || index === path.length - 1);
  }

  /**
   // Internal: Compares *path* against *key* for equality until one of the
   // following criterias is met:
   //
   // - End of *path* or *key* is reached.
   // - A separator (`/`) is found.
   // - A named parameter (`:`) or catch all (`*`) is found.
   // - A character in *path* differs from *key*
   //
   // ```
   // _shared_key?("foo", "bar")         # => false (mismatch at 1st character)
   // _shared_key?("foo/bar", "foo/baz") # => true (only `foo` is compared)
   // _shared_key?("zipcode", "zip")     # => true (only `zip` is compared)
   // _shared_key?("s", "/new")          # => false (1st character is a separator)
   // ```
   */
  private isSharedKey(path: string, key: string): boolean {
    let index = 0;
    if (path[index] !== key[index] && this.isMarker(key[index])) return false;

    let different = false;

    while (
      index < path.length &&
      !this.isMarker(path[index]) &&
      index < key.length &&
      !this.isMarker(key[index])
    ) {
      if (path[index] !== key[index]) {
        different = true;
        break;
      }
      index++;
    }

    return !different && (index >= key.length || this.isMarker(key[index]));
  }

  /**
   # Internal: allow inline comparison of *char* against 3 defined markers:
   #
   # - Path separator (`/`)
   # - Named parameter (`:`)
   # - Catch all (`*`)
   */
  private isMarker(char: string): boolean {
    return char === "/" || char === ":" || char === "*";
  }

  private getParamSize(reader: Reader): number {
    const position = reader.position;

    while (reader.hasNext) {
      if (reader.current === "/") break;
      reader.next();
    }
    const count = reader.position - position;
    reader.position = position;
    return count;
  }

  toJSON() {
    return { root: this.root.toJSON() };
  }
}

export default class Radix<T> extends Tree<T> {
  static Tree = Tree;
  static Node = Node;
  static Result = Result;
}
