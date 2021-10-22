/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : Tuesday Jul 13, 2021 22:35:36 CST
 *
 * @description : node.spec
 *
 ******************************************************************************/

import { Node } from "../index";

describe(Node, () => {
  describe("#glob?", () => {
    it("returns true when key contains a glob parameter (catch all)", () => {
      let node = new Node("a");
      expect(node.isGlob).toBe(false);

      node = new Node("*filepath");
      expect(node.isGlob).toBe(true);
    });
  });

  describe("#key=", () => {
    it("accepts change of key after initialization", () => {
      const node = new Node("abc");
      expect(node.key).toBe("abc");

      node.key = "xyz";
      expect(node.key).toBe("xyz");
    });

    it("also changes kind when modified", () => {
      const node = new Node("abc");
      expect(node.isNormal).toBe(true);

      node.key = ":query";
      expect(node.isNormal).toBe(false);
      expect(node.isNamed).toBe(true);
    });
  });

  describe("#named?", () => {
    it("returns true when key contains a named parameter", () => {
      let node = new Node("a");
      expect(node.isNamed).toBe(false);

      node = new Node(":query");
      expect(node.isNamed).toBe(true);
    });
  });

  describe("#normal?", () => {
    it("returns true when key does not contain named or glob parameters", () => {
      let node = new Node("a");
      expect(node.isNormal).toBe(true);

      node = new Node(":query");
      expect(node.isNormal).toBe(false);

      node = new Node("*path");
      expect(node.isNormal).toBe(false);
    });
  });

  describe("#payload", () => {
    it("accepts any form of payload", function () {
      const payload = Symbol("payload");
      let node: Node<any> = new Node("abc", payload);
      expect(node.payload).toBeTruthy();
      expect(node.payload).toBe(payload);

      node = new Node("abc", 1000);
      expect(node.payload).toBeTruthy();
      expect(node.payload).toBe(1000);
    });

    // This example focuses on the internal representation of `payload`
    // as inferred from supplied types and default values.
    //
    // We cannot compare `typeof` against `property!` since it excludes `Nil`
    // from the possible types.
    it("makes optional to provide a payload", function () {
      const node = new Node<number>("abc");
      expect(node.payload).toBeFalsy();
      expect(node.payload).toBe(null);
    });
  });

  describe("#priority", () => {
    it("calculates it based on key length", () => {
      let node = new Node("a");
      expect(node.priority).toBe(1);

      node = new Node("abc");
      expect(node.priority).toBe(3);
    });

    it("considers key length up until named parameter presence", () => {
      let node = new Node("/posts/:id");
      expect(node.priority).toBe(7);

      node = new Node("/u/:username");
      expect(node.priority).toBe(3);
    });

    it("considers key length up until glob parameter presence", () => {
      let node = new Node("/search/*query");
      expect(node.priority).toBe(8);

      node = new Node("/*anything");
      expect(node.priority).toBe(1);
    });

    it("changes when key changes", () => {
      const node = new Node("a");
      expect(node.priority).toBe(1);

      node.key = "abc";
      expect(node.priority).toBe(3);

      node.key = "/src/*filepath";
      expect(node.priority).toBe(5);

      node.key = "/search/:query";
      expect(node.priority).toBe(8);
    });
  });

  describe("#sort!", () => {
    it("orders children", () => {
      const root = new Node("/");
      const node1 = new Node("a", 1);
      const node2 = new Node("bc", 2);
      const node3 = new Node("def", 3);

      root.children.push(node1, node2, node3);
      root.sort();

      expect(root.children[0]).toBe(node3);
      expect(root.children[1]).toBe(node2);
      expect(root.children[2]).toBe(node1);
    });

    it("orders catch all and named parameters lower than normal nodes", () => {
      const root = new Node("/");
      const node1 = new Node("*path", 1);
      const node2 = new Node("abc", 2);
      const node3 = new Node(":query", 3);

      root.children.push(node1, node2, node3);
      root.sort();

      expect(root.children[0]).toBe(node2);
      expect(root.children[1]).toBe(node3);
      expect(root.children[2]).toBe(node1);
    });
  });
});
