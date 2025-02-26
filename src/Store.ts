import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

type Point = {
  X: number;
  Y: number;
}

type State = {
    message: string;
    isLoading: boolean;
    nodes: Node[];
}

type Actions = {
    addNode: (point: Point) => void;
    setMessage: (msg: string) => void;
}

export const useStore = create<State & Actions>()(
    devtools(
        immer((set, get) => ({
            message: "Click on the misterious globe.",
            setMessage: (msg: string) => {
                set((state) => {
                    state.message = msg;
                });
            },
            nodes: [],
            addNode: (point: Point) => {
                const log = get().setMessage;

                if (!get().isLoading) {
                    set((state) => {
                        state.isLoading = true;
                        state.nodes.push(point);
                    });

                    console.log("Node pushed. Now loading...");
                    log("Node pushed. Now loading...");

                    new Promise((resolve) => {
                        // emulate a 10 seconds job
                        setTimeout(() => {
                            resolve();
                        }, 10000);
                    }).then(() => {
                        console.log("Job completed after 10 seconds. Click again.");
                        log("Job completed after 10 seconds. Click again.");
                        set((state) => { state.isLoading = false; });
                    });
                } else {
                    console.log("Not now, my friend. I'm busy.");
                    log("Not now, my friend. I'm busy.");
                }
            }
        }))
    )
);
