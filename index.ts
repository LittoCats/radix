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

class RadixTree<T> {
  private _root: Node<T> = new Node<T>("", undefined, true);
  get root(): Node<T> {
    return this._root;
  }

  /**
   # Inserts given *path* into the Tree
   #
   # * *path* - An `String` representing the pattern to be inserted.
   # * *payload* - Required associated element for this path.
   #
   # If no previous elements existed in the Tree, this will replace the
   # defined placeholder.
   #
   # ```
   # tree = Radix::Tree(Symbol).new
   #
   # # /         (:root)
   # tree.add "/", :root
   #
   # # /         (:root)
   # # \-abc     (:abc)
   # tree.add "/abc", :abc
   #
   # # /         (:root)
   # # \-abc     (:abc)
   # #     \-xyz (:xyz)
   # tree.add "/abcxyz", :xyz
   # ```
   #
   # Nodes inside the tree will be adjusted to accommodate the different
   # segments of the given *path*.
   #
   # ```
   # tree = Radix::Tree(Symbol).new
   #
   # # / (:root)
   # tree.add "/", :root
   #
   # # /                   (:root)
   # # \-products/:id      (:product)
   # tree.add "/products/:id", :product
   #
   # # /                    (:root)
   # # \-products/
   # #           +-featured (:featured)
   # #           \-:id      (:product)
   # tree.add "/products/featured", :featured
   # ```
   #
   # Catch all (globbing) and named parameters *path* will be located with
   # lower priority against other nodes.
   #
   # ```
   # tree = Radix::Tree(Symbol).new
   #
   # # /           (:root)
   # tree.add "/", :root
   #
   # # /           (:root)
   # # \-*filepath (:all)
   # tree.add "/*filepath", :all
   #
   # # /           (:root)
   # # +-about     (:about)
   # # \-*filepath (:all)
   # tree.add "/about", :about
   # ```
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
      newNode.children.push(...node.children);

      // # clear payload and children (this is no longer and endpoint)
      node.key = path.slice(0, index);
      node.children.push(newNode);
      node.sort();

      // # determine if path still continues
      if (index < path.length) {
        const newKey = path.slice(index);
        node.children.push(new Node<T>(newKey, payload));
        node.sort();

        // clear payload (no endpoint)
        node.payload = undefined;
      } else {
        // this is an endpoint, set payload
        node.payload = payload;
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
   # Internal: Compares *path* against *key* for equality until one of the
   # following criterias is met:
   #
   # - End of *path* or *key* is reached.
   # - A separator (`/`) is found.
   # - A named parameter (`:`) or catch all (`*`) is found.
   # - A character in *path* differs from *key*
   #
   # ```
   # _shared_key?("foo", "bar")         # => false (mismatch at 1st character)
   # _shared_key?("foo/bar", "foo/baz") # => true (only `foo` is compared)
   # _shared_key?("zipcode", "zip")     # => true (only `zip` is compared)
   # _shared_key?("s", "/new")          # => false (1st character is a separator)
   # ```
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

  private getParamSize(path: string, start: number): number {
    let index = start;
    while (index < path.length) {
      if (path[index] === "/") break;
      index++;
    }
    return index - start;
  }

  toJSON() {
    return { root: this.root.toJSON() };
  }
}

export default class Radix<T> extends RadixTree<T> {}
