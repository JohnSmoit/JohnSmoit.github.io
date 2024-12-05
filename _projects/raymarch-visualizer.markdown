---
layout: project
title: Raymarching Visualization
snippet: An application designed to ease development of raymarched visuals

screenshots: 
    - src: raymarch-visualizer-1.png
tools_used: 
    - c
    - c++
    - Win32
    - OpenGL
    - IMGUI
    - GLSL
project_url: https://github.com/JohnSmoit/jerry-engine
---

I designed and implemented a hardware-accelerated rendering engine and visualization tool for the raymarching and display of 3D objects represented by signed distance functions. Built on top of the Win32 API and OpenGL, with custom extensions to GLSL (OpenGL shading language) for a friendlier user experience in writing Raymarching shaders.

It is suitable for testing and loading GLSL raymarching shaders and supports a few custom extensions to the language in order to make editing uniforms and hot reloading the shader display more convenient.

This is a side accompaniment to a larger more fully featured rendering engine currently in development for raymarching.

For more information on raymarching, check out [this blog post]() for an introduction.
