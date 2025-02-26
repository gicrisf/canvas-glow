import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { devtools } from 'zustand/middleware';

type Point = {
  X: number;
  Y: number;
}

type State = {
    isLoading: boolean;
    nodes: Node[];
}

type Actions = {
    addNode: (point: Point) => void;
}

export const useStore = create<State & Actions>()(
    devtools(
        immer((set, get) => ({
            nodes: [],
            addNode: (point: Point) => {
                if (!get().isLoading) {
                    set((state) => {
                        state.isLoading = true;
                        state.nodes.push(point);
                    });

                    console.log("Node pushed. Now loading...");

                    new Promise((resolve) => {
                        // emulate a 10 seconds job
                        setTimeout(() => {
                            resolve();
                        }, 10000);
                    }).then(() => {
                        console.log("Job completed after 10 seconds.");
                        set((state) => { state.isLoading = false; });
                    });
                }
            }
        }))
    )
);
