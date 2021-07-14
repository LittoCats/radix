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

  // describe "#find" do
  //   describe "a single node" do
  //     it "does not find when using different path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/about", :about

  //       result = tree.find "/products"
  //       result.found?.should be_false
  //     end

  //     it "finds when key and path matches" do
  //       tree = Tree(Symbol).new
  //       tree.add "/about", :about

  //       result = tree.find "/about"
  //       result.found?.should be_true
  //       result.payload?.should be_truthy
  //       result.payload.should eq(:about)
  //     end

  //     it "finds when path contains trailing slash" do
  //       tree = Tree(Symbol).new
  //       tree.add "/about", :about

  //       result = tree.find "/about/"
  //       result.found?.should be_true
  //     end

  //     it "finds when key contains trailing slash" do
  //       tree = Tree(Symbol).new
  //       tree.add "/about/", :about

  //       result = tree.find "/about"
  //       result.found?.should be_true
  //       result.payload.should eq(:about)
  //     end
  //   end

  //   describe "nodes with shared parent" do
  //     it "finds matching path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/abc", :abc
  //       tree.add "/axyz", :axyz

  //       result = tree.find("/abc")
  //       result.found?.should be_true
  //       result.payload.should eq(:abc)
  //     end

  //     it "finds matching path across separator" do
  //       tree = Tree(Symbol).new
  //       tree.add "/products", :products
  //       tree.add "/product/new", :product_new

  //       result = tree.find("/products")
  //       result.found?.should be_true
  //       result.payload.should eq(:products)
  //     end

  //     it "finds matching path across parents" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/admin/users", :users
  //       tree.add "/admin/products", :products
  //       tree.add "/blog/tags", :tags
  //       tree.add "/blog/articles", :articles

  //       result = tree.find("/blog/tags/")
  //       result.found?.should be_true
  //       result.payload.should eq(:tags)
  //     end

  //     it "do not find when lookup for non-root key" do
  //       tree = Tree(Symbol).new
  //       tree.add "/prefix/", :prefix
  //       tree.add "/prefix/foo", :foo

  //       result = tree.find "/foo"
  //       result.found?.should be_false
  //     end
  //   end

  //   describe "unicode nodes with shared parent" do
  //     it "finds matching path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/日本語", :japanese
  //       tree.add "/日本日本語は難しい", :japanese_is_difficult

  //       result = tree.find("/日本日本語は難しい/")
  //       result.found?.should be_true
  //       result.payload.should eq(:japanese_is_difficult)
  //     end
  //   end

  //   describe "dealing with catch all" do
  //     it "finds matching path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/*filepath", :all
  //       tree.add "/about", :about

  //       result = tree.find("/src/file.png")
  //       result.found?.should be_true
  //       result.payload.should eq(:all)
  //     end

  //     it "returns catch all in parameters" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/*filepath", :all
  //       tree.add "/about", :about

  //       result = tree.find("/src/file.png")
  //       result.found?.should be_true
  //       result.params.has_key?("filepath").should be_true
  //       result.params["filepath"].should eq("src/file.png")
  //     end

  //     it "returns optional catch all after slash" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/search/*extra", :extra

  //       result = tree.find("/search")
  //       result.found?.should be_true
  //       result.params.has_key?("extra").should be_true
  //       result.params["extra"].empty?.should be_true
  //     end

  //     it "returns optional catch all by globbing" do
  //       tree = Tree(Symbol).new
  //       tree.add "/members*trailing", :members_catch_all

  //       result = tree.find("/members")
  //       result.found?.should be_true
  //       result.params.has_key?("trailing").should be_true
  //       result.params["trailing"].empty?.should be_true
  //     end

  //     it "does not find when catch all is not full match" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/search/public/*query", :search

  //       result = tree.find("/search")
  //       result.found?.should be_false
  //     end

  //     it "does not find when path search has been exhausted" do
  //       tree = Tree(Symbol).new
  //       tree.add "/members/*trailing", :members_catch_all

  //       result = tree.find("/members2")
  //       result.found?.should be_false
  //     end

  //     it "does prefer specific path over catch all if both are present" do
  //       tree = Tree(Symbol).new
  //       tree.add "/members", :members
  //       tree.add "/members*trailing", :members_catch_all

  //       result = tree.find("/members")
  //       result.found?.should be_true
  //       result.payload.should eq(:members)
  //     end

  //     it "does prefer catch all over specific key with partially shared key" do
  //       tree = Tree(Symbol).new
  //       tree.add "/orders/*anything", :orders_catch_all
  //       tree.add "/orders/closed", :closed_orders

  //       result = tree.find("/orders/cancelled")
  //       result.found?.should be_true
  //       result.payload.should eq(:orders_catch_all)
  //       result.params.has_key?("anything").should be_true
  //       result.params["anything"].should eq("cancelled")
  //     end

  //     it "does prefer root catch all over specific partially shared key" do
  //       tree = Tree(Symbol).new
  //       tree.add "/*anything", :root_catch_all
  //       tree.add "/robots.txt", :robots
  //       tree.add "/resources", :resources

  //       result = tree.find("/reviews")
  //       result.found?.should be_true
  //       result.payload.should eq(:root_catch_all)
  //       result.params.has_key?("anything").should be_true
  //       result.params["anything"].should eq("reviews")
  //     end
  //   end

  //   describe "dealing with named parameters" do
  //     it "finds matching path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/products", :products
  //       tree.add "/products/:id", :product
  //       tree.add "/products/:id/edit", :edit

  //       result = tree.find("/products/10")
  //       result.found?.should be_true
  //       result.payload.should eq(:product)
  //     end

  //     it "does not find partial matching path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/products", :products
  //       tree.add "/products/:id/edit", :edit

  //       result = tree.find("/products/10")
  //       result.found?.should be_false
  //     end

  //     it "returns named parameters in result" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/products", :products
  //       tree.add "/products/:id", :product
  //       tree.add "/products/:id/edit", :edit

  //       result = tree.find("/products/10/edit")
  //       result.found?.should be_true
  //       result.params.has_key?("id").should be_true
  //       result.params["id"].should eq("10")
  //     end

  //     it "returns unicode values in parameters" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/language/:name", :language
  //       tree.add "/language/:name/about", :about

  //       result = tree.find("/language/日本語")
  //       result.found?.should be_true
  //       result.params.has_key?("name").should be_true
  //       result.params["name"].should eq("日本語")
  //     end

  //     it "does prefer specific path over named parameters one if both are present" do
  //       tree = Tree(Symbol).new
  //       tree.add "/tag-edit/:tag", :edit_tag
  //       tree.add "/tag-edit2", :alternate_tag_edit

  //       result = tree.find("/tag-edit2")
  //       result.found?.should be_true
  //       result.payload.should eq(:alternate_tag_edit)
  //     end

  //     it "does prefer named parameter over specific key with partially shared key" do
  //       tree = Tree(Symbol).new
  //       tree.add "/orders/:id", :specific_order
  //       tree.add "/orders/closed", :closed_orders

  //       result = tree.find("/orders/10")
  //       result.found?.should be_true
  //       result.payload.should eq(:specific_order)
  //       result.params.has_key?("id").should be_true
  //       result.params["id"].should eq("10")
  //     end
  //   end

  //   describe "dealing with multiple named parameters" do
  //     it "finds matching path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/:section/:page", :static_page

  //       result = tree.find("/about/shipping")
  //       result.found?.should be_true
  //       result.payload.should eq(:static_page)
  //     end

  //     it "returns named parameters in result" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/:section/:page", :static_page

  //       result = tree.find("/about/shipping")
  //       result.found?.should be_true

  //       result.params.has_key?("section").should be_true
  //       result.params["section"].should eq("about")

  //       result.params.has_key?("page").should be_true
  //       result.params["page"].should eq("shipping")
  //     end
  //   end

  //   describe "dealing with both catch all and named parameters" do
  //     it "finds matching path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/", :root
  //       tree.add "/*filepath", :all
  //       tree.add "/products", :products
  //       tree.add "/products/:id", :product
  //       tree.add "/products/:id/edit", :edit
  //       tree.add "/products/featured", :featured

  //       result = tree.find("/products/1000")
  //       result.found?.should be_true
  //       result.payload.should eq(:product)

  //       result = tree.find("/admin/articles")
  //       result.found?.should be_true
  //       result.payload.should eq(:all)
  //       result.params["filepath"].should eq("admin/articles")

  //       result = tree.find("/products/featured")
  //       result.found?.should be_true
  //       result.payload.should eq(:featured)
  //       result.payload.should eq(:featured)
  //     end
  //   end

  //   describe "dealing with named parameters and shared key" do
  //     it "finds matching path" do
  //       tree = Tree(Symbol).new
  //       tree.add "/one/:id", :one
  //       tree.add "/one-longer/:id", :two

  //       result = tree.find "/one-longer/10"
  //       result.found?.should be_true
  //       result.payload.should eq(:two)
  //       result.params["id"].should eq("10")
  //     end
  //   end
  // end
});
