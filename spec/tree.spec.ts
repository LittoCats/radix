/*******************************************************************************
 * @author      : 程巍巍 (littocats@gmail.com)
 * @created     : Tuesday Jul 13, 2021 22:36:35 CST
 *
 * @description : result.spec
 *
 ******************************************************************************/

import { Tree, Node, DuplicateError, SharedKeyError } from "../index";

describe(Tree, () => {
  describe("is same key", () => {
    const isSameKey = (Tree.prototype as any).isSameKey.bind(new Tree());

    expect(isSameKey("foo", "bar")).toBeFalsy();
    expect(isSameKey("foo/bar", "foo/baz")).toBeTruthy();
    expect(isSameKey("zipcode", "zip")).toBeFalsy();
  });

  describe("is shared key", () => {
    const isSharedKey = (Tree.prototype as any).isSharedKey.bind(new Tree());

    expect(isSharedKey("foo", "bar")).toBeFalsy();
    expect(isSharedKey("foo/bar", "foo/baz")).toBeTruthy();
    expect(isSharedKey("zipcode", "zip")).toBeTruthy();
    expect(isSharedKey("s", "/new")).toBeFalsy();
  });

  describe("a new instance", () => {
    it("contains a root placeholder node", () => {
      const tree = new Tree();
      expect(tree.root).toBeInstanceOf(Node);
      expect(tree.root.payload).toBeFalsy();
      expect(tree.root.placeholder).toBeTruthy();
    });
  });

  describe("#add", () => {
    describe("on a new instance", () => {
      it("replaces placeholder with new node", () => {
        const tree = new Tree();
        tree.add("/abc", Symbol.for(":abc"));

        expect(tree.root).toBeInstanceOf(Node);
        expect(tree.root.placeholder).toBeFalsy();
        expect(tree.root.payload).toBeTruthy();
        expect(tree.root.payload).toBe(Symbol.for(":abc"));
      });
    });

    describe("shard root", () => {
      it("inserts properly adjacent nodes", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/a", Symbol.for(":a"));
        tree.add("/bc", Symbol.for(":bc"));

        // /    (:root)
        // +-bc (:bc)
        // \-a  (:a)
        expect(tree.root.children.length).toBe(2);
        expect(tree.root.children[0].key).toBe("bc");
        expect(tree.root.children[0].payload).toBe(Symbol.for(":bc"));
        expect(tree.root.children[1].key).toBe("a");
        expect(tree.root.children[1].payload).toBe(Symbol.for(":a"));
      });

      it("inserts nodes with shared parent", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/abc", Symbol.for(":abc"));
        tree.add("/axyz", Symbol.for(":axyz"));

        // /      (:root)
        // +-a
        // +-xyz  (:axyz)
        // \-bc   (:abc)
        expect(tree.root.children.length).toBe(1);
        expect(tree.root.children[0].key).toBe("a");
        expect(tree.root.children[0].children.length).toBe(2);
        expect(tree.root.children[0].children[0].key).toBe("xyz");
        expect(tree.root.children[0].children[1].key).toBe("bc");
      });

      it("inserts multiple parent nodes", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/admin/users", Symbol.for(":users"));
        tree.add("/admin/products", Symbol.for(":products"));
        tree.add("/blog/tags", Symbol.for(":tags"));
        tree.add("/blog/articles", Symbol.for(":articles"));

        //  /                 (:root)
        //  +-admin/
        //  |      +-products (:products)
        //  |      \-users    (:users)
        //  |
        //  +-blog/
        //        +-articles  (:articles)
        //        \-tags      (:tags)
        expect(tree.root.children.length).toBe(2);
        expect(tree.root.children[0].key).toBe("admin/");
        expect(tree.root.children[0].payload).toBeFalsy();
        expect(tree.root.children[0].children[0].key).toBe("products");
        expect(tree.root.children[0].children[1].key).toBe("users");
        expect(tree.root.children[1].key).toBe("blog/");
        expect(tree.root.children[1].payload).toBeFalsy();
        expect(tree.root.children[1].children[0].key).toBe("articles");
        expect(tree.root.children[1].children[0].payload).toBeTruthy();
        expect(tree.root.children[1].children[1].key).toBe("tags");
        expect(tree.root.children[1].children[1].payload).toBeTruthy();
      });

      it("inserts multiple nodes with mixed parents", () => {
        const tree = new Tree();
        tree.add("/authorizations", Symbol.for(":authorizations"));
        tree.add("/authorizations/:id", Symbol.for(":authorization"));
        tree.add("/applications", Symbol.for(":applications"));
        tree.add("/events", Symbol.for(":events"));

        // /
        // +-events               (:events)
        // +-a
        //   +-uthorizations      (:authorizations)
        //   |             \-/:id (:authorization)
        //   \-pplications        (:applications)
        expect(tree.root.children.length).toBe(2);
        expect(tree.root.children[1].key).toBe("a");
        expect(tree.root.children[1].children.length).toBe(2);
        expect(tree.root.children[1].children[0].payload).toBe(
          Symbol.for(":authorizations")
        );
        expect(tree.root.children[1].children[1].payload).toBe(
          Symbol.for(":applications")
        );
      });

      it("supports insertion of mixed routes out of order", () => {
        const tree = new Tree();
        tree.add("/user/repos", Symbol.for(":my_repos"));
        tree.add("/users/:user/repos", Symbol.for(":user_repos"));
        tree.add("/users/:user", Symbol.for(":user"));
        tree.add("/user", Symbol.for(":me"));

        // /user                (:me)
        //     +-/repos         (:my_repos)
        //     \-s/:user        (:user)
        //             \-/repos (:user_repos)
        expect(tree.root.key).toBe("/user");
        expect(tree.root.payload).toBeTruthy();
        expect(tree.root.payload).toBe(Symbol.for(":me"));
        expect(tree.root.children.length).toBe(2);
        expect(tree.root.children[0].key).toBe("/repos");
        expect(tree.root.children[1].key).toBe("s/:user");
        expect(tree.root.children[1].payload).toBe(Symbol.for(":user"));
        expect(tree.root.children[1].children[0].key).toBe("/repos");
      });
    });

    describe("mixed payloads", () => {
      it("allows node with different payloads", () => {
        const payload1 = "string";
        const payload2 = 1234;
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/a", payload1);
        tree.add("/bc", payload2);
        // /    (:root)
        // +-bc (payload2)
        // \-a  (payload1)
        expect(tree.root.children.length).toBe(2);
        expect(tree.root.children[0].key).toBe("bc");
        expect(tree.root.children[0].payload).toBe(payload2);
        expect(tree.root.children[1].key).toBe("a");
        expect(tree.root.children[1].payload).toBe(payload1);
      });
    });

    describe("dealing with unicode", () => {
      it("inserts properly adjacent parent nodes", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/日本語", Symbol.for(":japanese"));
        tree.add("/素晴らしい", Symbol.for(":amazing"));
        // /          (:root)
        // +-素晴らしい    (:amazing)
        // \-日本語      (:japanese)
        expect(tree.root.children.length).toBe(2);
        expect(tree.root.children[0].key).toBe("素晴らしい");
        expect(tree.root.children[1].key).toBe("日本語");
      });
      it("inserts nodes with shared parent", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for("root"));
        tree.add("/日本語", Symbol.for("japanese"));
        tree.add("/日本は難しい", Symbol.for("japanese_is_difficult"));
        // /                (:root)
        // \-日本語            (:japanese)
        //     \-日本は難しい     (:japanese_is_difficult)
        expect(tree.root.children.length).toBe(1);
        expect(tree.root.children[0].key).toBe("日本");
        expect(tree.root.children[0].children.length).toBe(2);
        expect(tree.root.children[0].children[0].key).toBe("は難しい");
        expect(tree.root.children[0].children[1].key).toBe("語");
      });
    });

    describe("dealing with duplicates", () => {
      it("does not allow same path be defined twice", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/abc", Symbol.for(":abc"));
        expect(() => tree.add("/", Symbol.for(":other"))).toThrow(
          DuplicateError
        );
        expect(tree.root.children.length).toBe(1);
      });
    });

    describe("dealing with catch all and named parameters", () => {
      it("prioritizes nodes correctly", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/*filepath", Symbol.for(":all"));
        tree.add("/products", Symbol.for(":products"));
        tree.add("/products/:id", Symbol.for(":product"));
        tree.add("/products/:id/edit", Symbol.for(":edit"));
        tree.add("/products/featured", Symbol.for(":featured"));
        // /                      (:all)
        // +-products             (:products)
        // |        \-/
        // |          +-featured  (:featured)
        // |          \-:id       (:product)
        // |              \-/edit (:edit)
        // \-*filepath            (:all)
        expect(tree.root.children.length).toBe(2);
        expect(tree.root.children[0].key).toBe("products");
        expect(tree.root.children[0].children[0].key).toBe("/");
        const nodes = tree.root.children[0].children[0].children;
        expect(nodes.length).toBe(2);
        expect(nodes[0].key).toBe("featured");
        expect(nodes[1].key).toBe(":id");
        expect(nodes[1].children[0].key).toBe("/edit");
        expect(tree.root.children[1].key).toBe("*filepath");
      });

      it("does not split named parameters across shared key", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/:category", Symbol.for(":category"));
        tree.add("/:category/:subcategory", Symbol.for(":subcategory"));
        // /                         (:root)
        // +-:category               (:category)
        //           \-/:subcategory (:subcategory)
        expect(tree.root.children.length).toBe(1);
        expect(tree.root.children[0].key).toBe(":category");
        // inner children
        expect(tree.root.children[0].children.length).toBe(1);
        expect(tree.root.children[0].children[0].key).toBe("/:subcategory");
      });

      it("does allow same named parameter in different order of insertion", () => {
        const tree = new Tree();
        tree.add("/members/:id/edit", Symbol.for(":member_edit"));
        tree.add("/members/export", Symbol.for(":members_export"));
        tree.add("/members/:id/videos", Symbol.for(":member_videos"));
        // /members/
        //         +-export      (:members_export)
        //         \-:id/
        //              +-videos (:members_videos)
        //              \-edit   (:members_edit)
        expect(tree.root.key).toBe("/members/");
        expect(tree.root.children.length).toBe(2);
        // firsexpect(t level children nodes
        expect(tree.root.children[0].key).toBe("export");
        expect(tree.root.children[1].key).toBe(":id/");
        // inner children
        const nodes = tree.root.children[1].children;
        expect(nodes[0].key).toBe("videos");
        expect(nodes[1].key).toBe("edit");
      });

      it("does not allow different named parameters sharing same level", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/:post", Symbol.for(":post"));

        expect(() =>
          tree.add("/:category/:post", Symbol.for(":category_post"))
        ).toThrow(SharedKeyError);
      });
    });
  });

  describe("#find", () => {
    describe("a single node", () => {
      it("does not find when using different path", () => {
        const tree = new Tree();
        tree.add("/about", Symbol.for(":about"));
        const result = tree.find("/products");
        expect(result.isFound).toBeFalsy();
      });
      it("finds when key and path matches", () => {
        const tree = new Tree();
        tree.add("/about", Symbol.for(":about"));
        const result = tree.find("/about");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":about"));
      });
      it("finds when path contains trailing slash", () => {
        const tree = new Tree();
        tree.add("/about", Symbol.for(":about"));
        const result = tree.find("/about/");
        expect(result.isFound).toBeTruthy();
      });
      it("finds when key contains trailing slash", () => {
        const tree = new Tree();
        tree.add("/about", Symbol.for(":about"));
        const result = tree.find("/about");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":about"));
      });
    });

    describe("nodes with shared parent", () => {
      it("finds matching path", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/abc", Symbol.for(":abc"));
        tree.add("/axyz", Symbol.for(":axyz"));
        const result = tree.find("/abc");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":abc"));
      });
      it("finds matching path across separator", () => {
        const tree = new Tree();
        tree.add("/products", Symbol.for(":products"));
        tree.add("/product/new", Symbol.for(":product_new"));
        const result = tree.find("/products");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":products"));
      });
      it("finds matching path across parents", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/admin/users", Symbol.for(":users"));
        tree.add("/admin/products", Symbol.for(":products"));
        tree.add("/blog/tags", Symbol.for(":tags"));
        tree.add("/blog/articles", Symbol.for(":articles"));
        const result = tree.find("/blog/tags/");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":tags"));
      });
      it("do not find(when lookup for non-root key", () => {
        const tree = new Tree();
        tree.add("/prefix/", Symbol.for(":prefix"));
        tree.add("/prefix/foo", Symbol.for(":foo"));
        const result = tree.find("/foo");
        expect(result.isFound).toBeFalsy();
      });
    });

    describe("unicode nodes with shared parent", () => {
      it("finds matching path", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/日本語", Symbol.for(":japanese"));
        tree.add("/日本日本語は難しい", Symbol.for(":japanese_is_difficult"));
        const result = tree.find("/日本日本語は難しい/");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":japanese_is_difficult"));
      });
    });

    describe("dealing with catch all", () => {
      it("finds matching path", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/*filepath", Symbol.for(":all"));
        tree.add("/about", Symbol.for(":about"));
        const result = tree.find("/src/file.png");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":all"));
      });
      it("returns catch all in parameters", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/*filepath", Symbol.for(":all"));
        tree.add("/about", Symbol.for(":about"));
        const result = tree.find("/src/file.png");
        expect(result.isFound).toBeTruthy();
        expect(result.params).toHaveProperty("filepath");
        expect(result.params["filepath"]).toBe("src/file.png");
      });
      it("returns optional catch all after slash", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/search/*extra", Symbol.for(":extra"));
        const result = tree.find("/search");
        expect(result.isFound).toBeTruthy();
        expect(result.params).toHaveProperty("extra");
        expect(result.params["extra"].length).toBe(0);
      });
      it("returns optional catch all by globbing", () => {
        const tree = new Tree();
        tree.add("/members*trailing", Symbol.for(":members_catch_all"));
        const result = tree.find("/members");
        expect(result.isFound).toBeTruthy();
        expect(result.params).toHaveProperty("trailing");
        expect(result.params["trailing"].length).toBe(0);
      });
      it("does not find(when catch all is not full match", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/search/public/*query", Symbol.for(":search"));
        const result = tree.find("/search");
        expect(result.isFound).toBeFalsy();
      });
      it("does not find(when path search has been exhausted", () => {
        const tree = new Tree();
        tree.add("/members/*trailing", Symbol.for(":members_catch_all"));
        const result = tree.find("/members2");
        expect(result.isFound).toBeFalsy();
      });
      it("does prefer specific path over catch all if both are present", () => {
        const tree = new Tree();
        tree.add("/members", Symbol.for(":members"));
        tree.add("/members*trailing", Symbol.for(":members_catch_all"));
        const result = tree.find("/members");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":members"));
      });
      it("does prefer catch all over specific key with partially shared key", () => {
        const tree = new Tree();
        tree.add("/orders/*anything", Symbol.for(":orders_catch_all"));
        tree.add("/orders/closed", Symbol.for(":closed_orders"));
        const result = tree.find("/orders/cancelled");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":orders_catch_all"));
        expect(result.params).toHaveProperty("anything");
        expect(result.params["anything"]).toBe("cancelled");
      });
      it("does prefer root catch all over specific partially shared key", () => {
        const tree = new Tree();
        tree.add("/*anything", Symbol.for(":root_catch_all"));
        tree.add("/robots.txt", Symbol.for(":robots"));
        tree.add("/resources", Symbol.for(":resources"));
        const result = tree.find("/reviews");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":root_catch_all"));
        expect(result.params).toHaveProperty("anything");
        expect(result.params["anything"]).toBe("reviews");
      });
    });
    describe("dealing with named parameters", () => {
      it("finds matching path", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/products", Symbol.for(":products"));
        tree.add("/products/:id", Symbol.for(":product"));
        tree.add("/products/:id/edit", Symbol.for(":edit"));
        const result = tree.find("/products/10");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":product"));
      });
      it("does not find partial matching path", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/products", Symbol.for(":products"));
        tree.add("/products/:id/edit", Symbol.for(":edit"));
        const result = tree.find("/products/10");
        expect(result.isFound).toBeFalsy();
      });
      it("returns named parameters in result", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/products", Symbol.for(":products"));
        tree.add("/products/:id", Symbol.for(":product"));
        tree.add("/products/:id/edit", Symbol.for(":edit"));
        const result = tree.find("/products/10/edit");
        expect(result.isFound).toBeTruthy();
        expect(result.params).toHaveProperty("id");
        expect(result.params["id"]).toBe("10");
      });
      it("returns unicode values in parameters", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/language/:name", Symbol.for(":language"));
        tree.add("/language/:name/about", Symbol.for(":about"));
        const result = tree.find("/language/日本語");
        expect(result.isFound).toBeTruthy();
        expect(result.params).toHaveProperty("name");
        expect(result.params["name"]).toBe("日本語");
        expect(result.payload).toBe(Symbol.for(":language"));
      });
      it("does prefer specific path over named parameters one if both are present", () => {
        const tree = new Tree();
        tree.add("/tag-edit/:tag", Symbol.for(":edit_tag"));
        tree.add("/tag-edit2", Symbol.for(":alternate_tag_edit"));
        const result = tree.find("/tag-edit2");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":alternate_tag_edit"));
      });
      it("does prefer named parameter over specific key with partially shared key", () => {
        const tree = new Tree();
        tree.add("/orders/:id", Symbol.for(":specific_order"));
        tree.add("/orders/closed", Symbol.for(":closed_orders"));
        const result = tree.find("/orders/10");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":specific_order"));
        expect(result.params).toHaveProperty("id");
        expect(result.params["id"]).toBe("10");
      });
    });
    describe("dealing with multiple named parameters", () => {
      it("finds matching path", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/:section/:page", Symbol.for(":static_page"));
        const result = tree.find("/about/shipping");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":static_page"));
      });
      it("returns named parameters in result", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/:section/:page", Symbol.for(":static_page"));
        const result = tree.find("/about/shipping");
        expect(result.isFound).toBeTruthy();
        expect(result.params).toHaveProperty("section");
        expect(result.params["section"]).toBe("about");
        expect(result.params).toHaveProperty("page");
        expect(result.params["page"]).toBe("shipping");
      });
    });
    describe("dealing with both catch all and named parameters", () => {
      it("finds matching path", () => {
        const tree = new Tree();
        tree.add("/", Symbol.for(":root"));
        tree.add("/*filepath", Symbol.for(":all"));
        tree.add("/products", Symbol.for(":products"));
        tree.add("/products/:id", Symbol.for(":product"));
        tree.add("/products/:id/edit", Symbol.for(":edit"));
        tree.add("/products/featured", Symbol.for(":featured"));
        let result = tree.find("/products/1000");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":product"));
        result = tree.find("/admin/articles");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":all"));
        expect(result.params["filepath"]).toBe("admin/articles");
        result = tree.find("/products/featured");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":featured"));
      });
    });
    describe("dealing with named parameters and shared key", () => {
      it("finds matching path", () => {
        const tree = new Tree();
        tree.add("/one/:id", Symbol.for(":one"));
        tree.add("/one-longer/:id", Symbol.for(":two"));
        const result = tree.find("/one-longer/10");
        expect(result.isFound).toBeTruthy();
        expect(result.payload).toBe(Symbol.for(":two"));
        expect(result.params).toHaveProperty("id");
        expect(result.params["id"]).toBe("10");
      });
    });
  });
});
