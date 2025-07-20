/**
 * @file chartConfig.ts
 * @description
 * This file is responsible for registering the necessary Chart.js parts
 * globally for rendering different types of charts across the application.
 * Components like bar, pie, radar, and line charts rely on the proper registration
 * of scales, elements, and plugins. This configuration ensures that all visualizations
 * render correctly without requiring repeated registration.
 * @author Raúl García Balongo
 * @date 2025
 */
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    RadialLinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    ArcElement,
    RadialLinearScale,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
);
