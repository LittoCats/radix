/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : Tuesday Jul 13, 2021 22:36:35 CST
 *
 * @description : result.spec
 *
 ******************************************************************************/

import { Node, Result } from "../index";

describe(Result, () => {
  describe("#found?", () => {
    describe("a new instance", () => {
      it("returns false when no payload is associated", () => {
        const result = new Result();
        expect(result.isFound).toBeFalsy();
      });
    });

    describe("with a payload", () => {
      it("returns true", () => {
        const node = new Node("/", Symbol.for(":root"));
        const result = new Result();
        result.use(node);

        expect(result.isFound).toBeTruthy();
      });
    });
  });

  describe("#use", () => {
    it("use the node payload", () => {
      const node = new Node("/", Symbol.for(":root"));
      const result = new Result();
      expect(result.payload).toBeFalsy();

      result.use(node);
      expect(result.payload).toBeTruthy();
      expect(result.payload).toBe(node.payload);
    });

    it("allow not to assign payload", () => {
      const node = new Node("/", Symbol.for(":root"));
      const result = new Result();
      expect(result.payload).toBeFalsy();

      result.use(node, false);
      expect(result.payload).toBeFalsy();
    });
  });
});
