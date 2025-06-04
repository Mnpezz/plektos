import { render } from "@testing-library/react";
import { test } from "vitest";
import App from "./App";
import { TestApp } from "@/test/TestApp";

test("App", () => {
  render(
    <TestApp>
      <App />
    </TestApp>
  );
});
