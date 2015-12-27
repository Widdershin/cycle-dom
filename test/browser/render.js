/** @jsx hJSX */
'use strict';
/* global describe, it, beforeEach */
let assert = require('assert');
let Cycle = require('@cycle/core');
let CycleDOM = require('../../src/cycle-dom');
let Fixture89 = require('./fixtures/issue-89');
let Rx = require('rx');
let {h, svg, div, p, span, h2, h3, h4, hJSX, select, option, makeDOMDriver} = CycleDOM;

function createRenderTarget(id = null) {
  let element = document.createElement('div');
  element.className = 'cycletest';
  if (id) {
    element.id = id;
  }
  document.body.appendChild(element);
  return element;
}

describe('Rendering', function () {
  describe('makeDOMDriver', function () {
    it('should accept a DOM element as input', function () {
      let element = createRenderTarget();
      assert.doesNotThrow(function () {
        makeDOMDriver(element);
      });
    });

    it('should accept a DocumentFragment as input', function () {
      let element = document.createDocumentFragment();
      assert.doesNotThrow(function () {
        makeDOMDriver(element);
      });
    });

    it('should accept a string selector to an existing element as input', function () {
      let id = 'testShouldAcceptSelectorToExisting';
      let element = createRenderTarget();
      element.id = id;
      assert.doesNotThrow(function () {
        makeDOMDriver('#' + id);
      });
    });

    it('should not accept a selector to an unknown element as input', function () {
      assert.throws(function () {
        makeDOMDriver('#nonsenseIdToNothing');
      }, /Cannot render into unknown element/);
    });

    it('should not accept a number as input', function () {
      assert.throws(function () {
        makeDOMDriver(123);
      }, /Given container is not a DOM element neither a selector string/);
    });

    it('should accept function as error callback', function () {
      let element = document.createDocumentFragment();
      let onError = function() {};
      assert.doesNotThrow(function () {
        makeDOMDriver(element, {onError});
      });
    });

    it('should not accept number as error callback', function () {
      let element = document.createDocumentFragment();
      assert.throws(function () {
        makeDOMDriver(element, {onError: 42});
      });
    });
  });

  describe('DOM Driver', function () {
    it('should throw if input is not an Observable<VTree>', function () {
      let domDriver = makeDOMDriver(createRenderTarget());
      assert.throws(function () {
        domDriver({});
      }, /The DOM driver function expects as input an Observable of virtual/);
    });

    it('should pass errors to error callback', function (done) {
      let error = new Error();
      let errorCallback = function(e) {
        assert.strictEqual(e, error);
        done();
      };

      function app() {
        return {
          DOM: Rx.Observable.throw(error)
        };
      }

      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget(), {onError: errorCallback})
      });
    });

    it('should have Observable `:root` in DOM source', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(
            div('.top-most', [
              p('Foo'),
              span('Bar')
            ])
          )
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(root => {
        let classNameRegex = /top\-most/;
        assert.strictEqual(root.tagName, 'DIV');
        let child = root.children[0];
        assert.notStrictEqual(classNameRegex.exec(child.className), null);
        assert.strictEqual(classNameRegex.exec(child.className)[0], 'top-most');
        sources.dispose();
        done();
      });
    });

    it('should have isolateSource() and isolateSink() in source', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(div())
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      assert.strictEqual(typeof sources.DOM.isolateSource, 'function');
      assert.strictEqual(typeof sources.DOM.isolateSink, 'function');
      sources.dispose();
      done();
    });

    it('should convert a simple virtual-dom <select> to DOM element', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(select('.my-class', [
            option({value: 'foo'}, 'Foo'),
            option({value: 'bar'}, 'Bar'),
            option({value: 'baz'}, 'Baz')
          ]))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let selectEl = root.querySelector('.my-class');
        assert.notStrictEqual(selectEl, null);
        assert.notStrictEqual(typeof selectEl, 'undefined');
        assert.strictEqual(selectEl.tagName, 'SELECT');
        sources.dispose();
        done();
      });
    });

    it('should convert a simple virtual-dom <select> (JSX) to DOM element', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(
            <select className="my-class">
              <option value="foo">Foo</option>
              <option value="bar">Bar</option>
              <option value="baz">Baz</option>
            </select>
          )
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let selectEl = root.querySelector('.my-class');
        assert.notStrictEqual(selectEl, null);
        assert.notStrictEqual(typeof selectEl, 'undefined');
        assert.strictEqual(selectEl.tagName, 'SELECT');
        sources.dispose();
        done();
      });
    });

    it('should allow virtual-dom Thunks in the VTree', function (done) {
      // The thunk
      let ConstantlyThunk = function(greeting){
        this.greeting = greeting;
      };
      ConstantlyThunk.prototype.type = 'Thunk';
      ConstantlyThunk.prototype.render = function(previous) {
        if (previous && previous.vnode) {
          return previous.vnode;
        } else {
          return h4('Constantly ' + this.greeting);
        }
      };
      // The Cycle.js app
      function app() {
        return {
          DOM: Rx.Observable.interval(10).take(5).map(i =>
            div([
              new ConstantlyThunk('hello' + i)
            ])
          )
        };
      }

      // Run it
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });

      // Assert it
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let selectEl = root.querySelector('h4');
        assert.notStrictEqual(selectEl, null);
        assert.notStrictEqual(typeof selectEl, 'undefined');
        assert.strictEqual(selectEl.tagName, 'H4');
        assert.strictEqual(selectEl.textContent, 'Constantly hello0');
        sources.dispose();
        done();
      });
    });

    it('should allow plain virtual-dom Widgets in the VTree', function (done) {
      // The widget
      const MyTestWidget = function (content) {
        this.content = content;
      };
      MyTestWidget.prototype.type = 'Widget';
      MyTestWidget.prototype.init = function() {
        const divElem = document.createElement('H4');
        const textElem = document.createTextNode('Content is ' + this.content);
        divElem.appendChild(textElem);
        return divElem;
      }
      MyTestWidget.prototype.update = function(previous, domNode) {
        return null
      }

      // The Cycle.js app
      function app() {
        return {
          DOM: Rx.Observable.just(div('.top-most', [
            p('Just a paragraph'),
            new MyTestWidget('hello world')
          ]))
        };
      }

      // Run it
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });

      // Assert it
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let selectEl = root.querySelector('h4');
        assert.notStrictEqual(selectEl, null);
        assert.notStrictEqual(typeof selectEl, 'undefined');
        assert.strictEqual(selectEl.tagName, 'H4');
        assert.strictEqual(selectEl.textContent, 'Content is hello world');
        sources.dispose();
        done();
      });
    });

    it('should catch interaction events coming from wrapped View', function (done) {
      // Make a View reactively imitating another View
      function app() {
        return {
          DOM: Rx.Observable.just(h3('.myelementclass', 'Foobar'))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      // Make assertions
      sources.DOM.select('.myelementclass').events('click').subscribe(ev => {
        assert.strictEqual(ev.type, 'click');
        assert.strictEqual(ev.target.textContent, 'Foobar');
        sources.dispose();
        done();
      });
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let myElement = root.querySelector('.myelementclass');
        assert.notStrictEqual(myElement, null);
        assert.notStrictEqual(typeof myElement, 'undefined');
        assert.strictEqual(myElement.tagName, 'H3');
        assert.doesNotThrow(function () {
          myElement.click();
        });
      });
    });

    it('should catch interaction events using id in DOM.select(cssSelector).events(event)', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(h3('.myelementclass', 'Foobar'))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget('parent-001'))
      });
      // Make assertions
      sources.DOM.select('#parent-001').events('click').subscribe(ev => {
        assert.strictEqual(ev.type, 'click');
        assert.strictEqual(ev.target.textContent, 'Foobar');
        sources.dispose();
        done();
      });
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let myElement = root.querySelector('.myelementclass');
        assert.notStrictEqual(myElement, null);
        assert.notStrictEqual(typeof myElement, 'undefined');
        assert.strictEqual(myElement.tagName, 'H3');
        assert.doesNotThrow(function () {
          myElement.click();
        });
      });
    });

    it('should catch user events using DOM.select().events()', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(h3('.myelementclass', 'Foobar'))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      // Make assertions
      sources.DOM.select('.myelementclass').events('click').subscribe(ev => {
        assert.strictEqual(ev.type, 'click');
        assert.strictEqual(ev.target.textContent, 'Foobar');
        sources.dispose();
        done();
      });
      sources.DOM.select(':root').observable.skip(1).take(1)
        .subscribe(function (root) {
          let myElement = root.querySelector('.myelementclass');
          assert.notStrictEqual(myElement, null);
          assert.notStrictEqual(typeof myElement, 'undefined');
          assert.strictEqual(myElement.tagName, 'H3');
          assert.doesNotThrow(function () {
            myElement.click();
          });
        });
    });

    it('should catch user events using DOM.select().select().events()', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(
            h3('.top-most', [
              h2('.bar', 'Wrong'),
              div('.foo', [
                h4('.bar', 'Correct')
              ])
            ])
          )
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      // Make assertions
      sources.DOM.select('.foo').select('.bar').events('click').subscribe(ev => {
        assert.strictEqual(ev.type, 'click');
        assert.strictEqual(ev.target.textContent, 'Correct');
        sources.dispose();
        done();
      });
      sources.DOM.select(':root').observable.skip(1).take(1)
        .subscribe(function (root) {
          let wrongElement = root.querySelector('.bar');
          let correctElement = root.querySelector('.foo .bar');
          assert.notStrictEqual(wrongElement, null);
          assert.notStrictEqual(correctElement, null);
          assert.notStrictEqual(typeof wrongElement, 'undefined');
          assert.notStrictEqual(typeof correctElement, 'undefined');
          assert.strictEqual(wrongElement.tagName, 'H2');
          assert.strictEqual(correctElement.tagName, 'H4');
          assert.doesNotThrow(function () {
            wrongElement.click();
            setTimeout(() => correctElement.click(), 5);
          });
        });
    });

    it('should catch events from many elements using DOM.select().events()', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(div('.parent', [
            h4('.clickable.first', 'First'),
            h4('.clickable.second', 'Second'),
          ]))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      let clicks = [];
      // Make assertions
      sources.DOM.select('.clickable').events('click').elementAt(0)
        .subscribe(ev => {
          assert.strictEqual(ev.type, 'click');
          assert.strictEqual(ev.target.textContent, 'First');
        });
      sources.DOM.select('.clickable').events('click').elementAt(1)
        .subscribe(ev => {
          assert.strictEqual(ev.type, 'click');
          assert.strictEqual(ev.target.textContent, 'Second');
          sources.dispose();
          done();
        });
      sources.DOM.select(':root').observable.skip(1).take(1)
        .subscribe(function (root) {
          let firstElem = root.querySelector('.first');
          let secondElem = root.querySelector('.second');
          assert.notStrictEqual(firstElem, null);
          assert.notStrictEqual(typeof firstElem, 'undefined');
          assert.notStrictEqual(secondElem, null);
          assert.notStrictEqual(typeof secondElem, 'undefined');
          assert.doesNotThrow(function () {
            firstElem.click();
            setTimeout(() => secondElem.click(), 1);
          });
        });
    });

    it('should catch interaction events using id in DOM.select', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(h3('#myElementId', 'Foobar'))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget('parent-002'))
      });
      // Make assertions
      sources.DOM.select('#myElementId').events('click').subscribe(ev => {
        assert.strictEqual(ev.type, 'click');
        assert.strictEqual(ev.target.textContent, 'Foobar');
        sources.dispose();
        done();
      });
      sources.DOM.select(':root').observable.skip(1).take(1)
        .subscribe(function (root) {
          let myElement = root.querySelector('#myElementId');
          assert.notStrictEqual(myElement, null);
          assert.notStrictEqual(typeof myElement, 'undefined');
          assert.strictEqual(myElement.tagName, 'H3');
          assert.doesNotThrow(function () {
            myElement.click();
          });
        });
    });

    describe('DOM.select()', function () {
      it('should be an object with observable and events()', function (done) {
        function app() {
          return {
            DOM: Rx.Observable.just(h3('.myelementclass', 'Foobar'))
          };
        }
        let {sinks, sources} = Cycle.run(app, {
          DOM: makeDOMDriver(createRenderTarget())
        });
        // Make assertions
        const selection = sources.DOM.select('.myelementclass');
        assert.strictEqual(typeof selection, 'object');
        assert.strictEqual(typeof selection.observable, 'object');
        assert.strictEqual(typeof selection.observable.subscribe, 'function');
        assert.strictEqual(typeof selection.events, 'function');
        sources.dispose();
        done();
      });

      it('should have an observable of DOM elements', function (done) {
        function app() {
          return {
            DOM: Rx.Observable.just(h3('.myelementclass', 'Foobar'))
          };
        }
        let {sinks, sources} = Cycle.run(app, {
          DOM: makeDOMDriver(createRenderTarget())
        });
        // Make assertions
        sources.DOM.select('.myelementclass').observable.skip(1).take(1)
          .subscribe(elements => {
            assert.notStrictEqual(elements, null);
            assert.notStrictEqual(typeof elements, 'undefined');
            // Is an Array
            assert.strictEqual(Array.isArray(elements), true);
            assert.strictEqual(elements.length, 1);
            // Array with the H3 element
            assert.strictEqual(elements[0].tagName, 'H3');
            assert.strictEqual(elements[0].textContent, 'Foobar');
            sources.dispose();
            done();
          });
      });

      it('should not select element outside the given scope', function (done) {
        function app() {
          return {
            DOM: Rx.Observable.just(
              h3('.top-most', [
                h2('.bar', 'Wrong'),
                div('.foo', [
                  h4('.bar', 'Correct')
                ])
              ])
            )
          };
        }
        let {sinks, sources} = Cycle.run(app, {
          DOM: makeDOMDriver(createRenderTarget())
        });
        // Make assertions
        sources.DOM.select('.foo').select('.bar').observable.skip(1).take(1)
          .subscribe(elements => {
            assert.strictEqual(elements.length, 1);
            let element = elements[0];
            assert.notStrictEqual(element, null);
            assert.notStrictEqual(typeof element, 'undefined');
            assert.strictEqual(element.tagName, 'H4');
            assert.strictEqual(element.textContent, 'Correct');
            sources.dispose();
            done();
          })
      });

      it('should select svg element', function (done) {
        function app() {
          let svgTriangle = svg('svg', {width: 150, height: 150}, [
            svg('polygon', {
              class: 'triangle',
              attributes: {
                points: '20 0 20 150 150 20'
              }
            }),
          ]);

          return {
            DOM: Rx.Observable.just(svgTriangle)
          };
        }

        let {sinks, sources} = Cycle.run(app, {
          DOM: makeDOMDriver(createRenderTarget())
        });

        // Make assertions
        const selection = sources.DOM.select('.triangle').observable.skip(1).take(1).subscribe(elements => {
          assert.strictEqual(elements.length, 1);
          let triangleElement = elements[0];
          assert.notStrictEqual(triangleElement, null);
          assert.notStrictEqual(typeof triangleElement, 'undefined');
          assert.strictEqual(triangleElement.tagName, 'polygon');
          done();
        });
      });
    });

    it('should allow subscribing to interactions', function (done) {
      // Make a View reactively imitating another View
      function app() {
        return {
          DOM: Rx.Observable.just(h3('.myelementclass', 'Foobar'))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      sources.DOM.select('.myelementclass').events('click').subscribe(ev => {
        assert.strictEqual(ev.type, 'click');
        assert.strictEqual(ev.target.textContent, 'Foobar');
        sources.dispose();
        done();
      });
      // Make assertions
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let myElement = root.querySelector('.myelementclass');
        assert.notStrictEqual(myElement, null);
        assert.notStrictEqual(typeof myElement, 'undefined');
        assert.strictEqual(myElement.tagName, 'H3');
        assert.doesNotThrow(function () {
          myElement.click();
        });
      });
    });

    it('should accept a view wrapping a VTree$ (#89)', function (done) {
      function app() {
        let number$ = Fixture89.makeModelNumber$();
        return {
          DOM: Fixture89.viewWithContainerFn(number$)
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });

      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        setTimeout(() => {
          let myelement = root.querySelector('.myelementclass');
          assert.notStrictEqual(myelement, null);
          assert.strictEqual(myelement.tagName, 'H3');
          assert.strictEqual(myelement.textContent, '123');
        }, 100);
        setTimeout(() => {
          let myelement = root.querySelector('.myelementclass');
          assert.notStrictEqual(myelement, null);
          assert.strictEqual(myelement.tagName, 'H3');
          assert.strictEqual(myelement.textContent, '456');
          sources.dispose();
          done();
        }, 500);
      });
    });

    it('should accept a view with VTree$ as the root of VTree', function (done) {
      function app() {
        let number$ = Fixture89.makeModelNumber$();
        return {
          DOM: Fixture89.viewWithoutContainerFn(number$)
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });

      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        setTimeout(() => {
          let myelement = root.querySelector('.myelementclass');
          assert.notStrictEqual(myelement, null);
          assert.strictEqual(myelement.tagName, 'H3');
          assert.strictEqual(myelement.textContent, '123');
        }, 100);
        setTimeout(() => {
          let myelement = root.querySelector('.myelementclass');
          assert.notStrictEqual(myelement, null);
          assert.strictEqual(myelement.tagName, 'H3');
          assert.strictEqual(myelement.textContent, '456');
          sources.dispose();
          done();
        }, 500);
      });
    });

    it('should render a VTree with a child Observable<VTree>', function (done) {
      function app() {
        let child$ = Rx.Observable.just(
          h4('.child', {}, 'I am a kid')
        ).delay(80);
        return {
          DOM: Rx.Observable.just(div('.my-class', [
            p({}, 'Ordinary paragraph'),
            child$
          ]))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let selectEl = root.querySelector('.child');
        assert.notStrictEqual(selectEl, null);
        assert.notStrictEqual(typeof selectEl, 'undefined');
        assert.strictEqual(selectEl.tagName, 'H4');
        assert.strictEqual(selectEl.textContent, 'I am a kid');
        sources.dispose();
        done();
      });
    });

    it('should render a VTree with a grandchild Observable<VTree>', function (done) {
      function app() {
        let grandchild$ = Rx.Observable.just(
            h4('.grandchild', {}, [
              'I am a baby'
            ])
          ).delay(20);
        let child$ = Rx.Observable.just(
            h3('.child', {}, [
              'I am a kid',
              grandchild$
            ])
          ).delay(80);
        return {
          DOM: Rx.Observable.just(div('.my-class', [
            p({}, 'Ordinary paragraph'),
            child$
          ]))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let selectEl = root.querySelector('.grandchild');
        assert.notStrictEqual(selectEl, null);
        assert.notStrictEqual(typeof selectEl, 'undefined');
        assert.strictEqual(selectEl.tagName, 'H4');
        assert.strictEqual(selectEl.textContent, 'I am a baby');
        sources.dispose();
        done();
      });
    });

    it('should render a SVG VTree with a child Observable<VTree>', function (done) {
      function app() {
        let child$ = Rx.Observable.just(
          svg('g', {
            attributes: {'class': 'child'}
          })
        ).delay(80);
        return {
          DOM: Rx.Observable.just(svg('svg', [
            svg('g'),
            child$
          ]))
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      sources.DOM.select(':root').observable.skip(1).take(1).subscribe(function (root) {
        let selectEl = root.querySelector('.child');
        assert.notStrictEqual(selectEl, null);
        assert.notStrictEqual(typeof selectEl, 'undefined');
        assert.strictEqual(selectEl.tagName, 'g');
        sources.dispose();
        done();
      });
    });

    it('should not work after has been disposed', function (done) {
      let number$ = Rx.Observable.range(1, 3)
        .concatMap(x => Rx.Observable.just(x).delay(50));
      function app() {
        return {
          DOM: number$.map(number =>
              h3('.target', String(number))
          )
        };
      }
      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });
      sources.DOM.select(':root').observable.skip(1).subscribe(function (root) {
        let selectEl = root.querySelector('.target');
        assert.notStrictEqual(selectEl, null);
        assert.notStrictEqual(typeof selectEl, 'undefined');
        assert.strictEqual(selectEl.tagName, 'H3');
        assert.notStrictEqual(selectEl.textContent, '3');
        if (selectEl.textContent === '2') {
          sources.dispose();
          sinks.dispose();
          setTimeout(() => {
            done();
          }, 100);
        }
      });
    });

    it('should only be concerned with values from the most recent nested Observable', function (done) {
      function app() {
        return {
          DOM: Rx.Observable.just(
            div(
              Rx.Observable
                .just(2)
                .startWith(1)
                .map((outer) =>
                  Rx.Observable.just(2)
                  .delay(0)
                  .startWith(1)
                  .map((inner) => div('.target', outer+'/'+inner))
                )
            )
          )
        };
      };

      let {sinks, sources} = Cycle.run(app, {
        DOM: makeDOMDriver(createRenderTarget())
      });

      const expected = Rx.Observable
        .from(['1/1','2/1','2/2'])

      sources.DOM.select('.target').observable
        .skip(1)
        .map((els) => els[0].innerHTML)
        .sequenceEqual(expected)
        .subscribe((areSame) => {
          assert.strictEqual(areSame, true);
          sources.dispose();
          sinks.dispose();
          done();
        });
    });
  });
});
