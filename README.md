# Building Robust React Apps with Zustand and Immer

## Introduction {#introduction}

For years, I dodged React like the plague. In fact, I avoided JavaScript altogether, even in web-related tasks. Take static site generators, for example. For my old chemistry blog, I experimented with a variety of tools, year by year: Pelican, Jekyll, Hugo, Grav... In the end, I settled on Zola. Fast, robust, no JS needed, perfect for CI/CD workflows. Just prerendered HTML and sprinkle scripts for flair (e.g. comments, a masonry in the home page ecc.).

Rust’s elegance and stability, though less prominent in web development, shine through in Zola, more than compensating for any niche limitations.
This, however, is a particular case, since we're just presenting static content: basically, most of the work is collapsed on the backend. But actual **web apps**? Rust’s Yew or Dioxus are promising but young.

I love to find refuge in Elm's elegance and solidity, but recently, I’ve been drawn back to React and JavaScript, both professionally and in personal projects. Time constraints and the appeal of leveraging the extensive ecosystem of UI libraries have played a significant role in this shift. What I discovered was a React that had matured significantly, driven by its hook system and TypeScript support.

Particularly, I stumbled upon a couple of libraries that have the potential to transform even the most complex app development workflows: Immer and Zustand. In this post, I’ll show you how these two libraries interoperate seamlessly, enabling you to architect applications that transcend the entropic morass of lifecycle chaos that once defined React’s class components.


## Zustand: a minimalist state solution {#zustand-a-minimalist-state-solution}

As a longtime admirer of Redux (and its Elm/Flux-inspired architecture), I initially leaned on its strict unidirectional flow. But Redux’s boilerplate often felt at odds with React’s evolving simplicity.

Let’s begin with the simplest case possible, something you can handle using a basic `useState` in React: a counter.

```typescript
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

export default App;
```

This example initializes a state variable `count` with an initial value of `0` and provides a button to increment it. How can you achieve the same with Zustand? First of all, you install Zustand.

```bash
npm install zustand
# or `bun add zustand`
```

The following code replicates the same behavior as the previous one.

```typescript
import create from 'zustand';

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));

function App() {
  const { count, increment } = useStore();

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}

export default App;
```

-   `useStore` is created using `zustand`'s `create` function.
-   It initializes a state with `count: 0` and an `increment` function that updates `count` by 1.
-   In the `App` component, `useStore` is used to access `count` and `increment`.
-   The current `count` is displayed, and a button triggers `increment` when clicked.

This case resembles the previous one but has nuanced differences that become important in structured contexts. Unlike `useState`, which provides a dedicated value-setter pair, Zustand actions should encapsulate entire workflows rather than individual parameter updates (hence we call the action `increment`, not just `setCount`). More complex scenarios will illustrate this distinction clearly.


## Effortless immutability with Immer {#effortless-immutability-with-immer}

Zustand simplifies state management, yet its requirement for immutable updates in JavaScript can feel like a labyrinthine chore, especially when dealing with nested state — which is basically all the time. Immer operates like a tiny JavaScript alchemist, transmuting mutable-like code into immutable state updates.

Let’s revisit the counter example, but this time, imagine we need to manage a more complex state object:

```typescript
import { useState } from 'react';

function App() {
  const [state, setState] = useState({ count: 0, history: [] });

  const increment = () => {
    setState((prevState) => ({
      count: prevState.count + 1,
      history: [...prevState.history, prevState.count],
    }));
  };

  return (
    <div>
      <p>Count: {state.count}</p>
      <button onClick={increment}>Increment</button>
    </div>
  );
}

export default App;
```

Here, we’re updating both `count` and `history`, which requires manually spreading and nesting state. This quickly becomes error-prone as state grows more complex.

With Immer, the same logic becomes cleaner and more intuitive. First, install Immer:

```bash
npm install immer
```

Now, let’s rewrite the increment function using Immer. Import `produce`:

```typescript
import { produce } from 'immer';
```

Use `produce`:

```typescript
const increment = () => {
    setState(
        produce((draft) => {
            draft.count += 1;
            draft.history.push(draft.count - 1);
        })
    );
};
```

-   `produce` takes a "draft" of the state, allowing you to write mutable-style code.
-   The `draft` is basically a proxy, and Immer automatically generates the next immutable state for you.
-   This eliminates the need for manual spreading and nesting.

Immer shines in scenarios where state is deeply nested or requires frequent updates. Its symbiosis with Zustand will become noticeable when we explore the middleware provided by Zustand itself.


## I Saw the Canvas Glow: a practical example {#i-saw-the-canvas-glow-a-practical-example}

Let’s design a slightly more complex scenario.


### The challenge {#the-challenge}

We want a web app where users can interact with a canvas. When a user clicks on the canvas, a point is added.

```typescript
// These are private variables declared somewhere
let isLoading: boolean;
let points: Point[];

// Points are added exclusively through this exported function
const addPoint = (point: Point) => {
    // Add the point to the list of points
    points.push(point)
}

// A function to reset the state
export const very_rude_reset = () => { points = [] };

// You maybe want a function to reset the state
export very_rude_reset = () => { points = [] };
// You may want additional functionality, but let's focus on the main part
// * adding points *
```

What’s the problem? Before storing the point, we need to perform a check on a remote server. This could take some time. However, we shouldn’t let this hinder us from developing a reactive application. The GUI must remain responsive and should provide feedback to the user, indicating that the app is working without appearing sluggish.

So, when a point is added, the app enters a **loading state**, waiting for the server’s response.

You can see the app in action [right here](https://chimerical-semifreddo-fe6dbc.netlify.app/).

How does all of this work?

To not overcomplicate the example, we simulate the server call with a timeout of 10 seconds, like this:

```typescript
let isLoading: boolean;
let points: Point[];

export const addPoint = (point: Point) => {
    if (!isLoading) {
        // We're now loading again
        isLoading = true;

        // Instead of this fetch...
        // fetch('/api/update', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(newPoint),
        // })
        // ...a handcrafted promise:
        new Promise((resolve) => {
            // Emulating a 10 seconds job
            setTimeout(() => {
                resolve();
            }, 10000);
        }).then(() => {
            // Adding point to the list of points...
            points.push(point)
        }).then(() => {
            console.log("Job completed after 10 sec. Ready again.");
            isLoading = false
        })
        ;
    }
}
// Other desirable actions...
```

See? Very simple. This way, we can test how out application behave in the worst case scenario.

Some (OOO people) might argue that this could be represented with a class and solved using encapsulation in an object, but we intentionally avoided that approach because we’re taking the functional path. Let’s look at the real implementation.


### The component {#the-component}

We're working in React (you didn’t forget, did you?). Let’s take a look at the main `App` component, which handles canvas rendering and user interactions:

```typescript
import { useRef, useEffect } from 'react'; // Everyday stuff
import { useStore } from './Store'; // <-- Zustand store!
// (We'll explore it right below)

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isLoading, points, addPoint, message } = useStore();

  // Effect for animations and aesthetic stuff
  // useEffect(() => { ... })

  // Handle left-click on the canvas to add a node
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const handleMouseClick = (event: MouseEvent) => {
        switch (event.button) {
          case 0: // Left click
            addNode({
              X: event.clientX,
              Y: event.clientY,
            });
            break;
          default:
            break;
        }
      };
      canvas.addEventListener('mousedown', handleMouseClick);
      return () => {
        canvas.removeEventListener('mousedown', handleMouseClick);
      };
    }
  }, []);

  // JSX with a title, message, canvas, and list of points
  return ("[...]")
}
```

You might have noticed the logic is missing here: that's because it is now fully encapsulated within Zustand.


### The store {#the-store}

We’ve already seen how the `create` function works: you define both state variables and actions (functions that modify the state) inside the `create` function. Next, let’s examine the Immer integration:

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useStore = create(
  immer((set, get) => ({ // <-- Immer middleware
    message: "Click on the mysterious globe.",
    setMessage: (msg: string) => {
      set((state) => {
        state.message = msg;
      });
    },
    // Adding points: we’re almost there, wait just a little more!
  }))
);
```

Essentially, we're wrapping the state creation inside another function, giving us Immer’s capabilities without explicitly calling `produce`. In this example, we’re focusing on the `message=/=setMessage` pair, as it’s the simplest way (I could think of) to demonstrate state mutation using the Immer middleware in Zustand.

Let’s encapsulate the logic we’ve seen earlier using this approach:

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useStore = create(
    immer((set, get) => ({ // <-- Immer middleware
        // [message/setMessage as before]
        // State variable for points
        points: [],
        // Adding points
        addPoint: (point: Point) => {
            const log = get().setMessage;

            // `isLoading` is now stored inside the store,
            // so we use the `get()` function
            // provided by the Immer middleware (up here)
            if (!get().isLoading) {
                set((state) => {
                    state.isLoading = true;
                    state.points.push(point);
                });
                log("Point pushed. Now loading...");

                new Promise((resolve) => {
                    // Emulate a 10-second job
                    setTimeout(() => {
                        resolve();
                    }, 10000);
                }).then(() => {
                    log("Job completed after 10 seconds. You can click again.");
                    set((state) => { state.isLoading = false; });
                });
            } else {
                log("Not now, my friend. I'm busy.");
            }
        }
    }))
);
```

We’ve done it! The `addPoint` action demonstrates handling asynchronous operations, such as the 10-second loading period (or, more realistically, a server call). Zustand doesn’t care whether your functions are synchronous or asynchronous (as long as they make sense).


## Conclusions {#conclusions}

In the end, Zustand and Immer make a strong pair for state management in React. Missing Rust/Elm’s guarantees? You’ll never fully replicate them in JS, but TypeScript, paired with modern tooling, partially bridges the gap. Zustand cuts through the noise with its clean, focused approach. Immer smooths out the rough edges of immutable updates, especially in nested states. Together, they let you build solid, fast apps with less code and fewer mistakes.

The example discussed demonstrates how these tools can handle both synchronous and asynchronous operations seamlessly. To explore the implementation further, check out the repository [here](https://github.com/gicrisf/canvas-glow). Leave a star if this post was useful for you!
