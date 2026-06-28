<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NSW Operations Portal - Map Layout</title>
  <link rel="shortcut icon" href="../../nsw.png" type="image/x-icon">

  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background: #f0f0f0;
      color: #1a1a1a;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 12px;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    .gov-banner {
      background: #1a1a1a;
      color: #ccc;
      font-size: 11px;
      padding: 3px 12px;
    }

    .site-header {
      background: #1d3f5e;
      color: #fff;
      padding: 10px 16px;
      border-bottom: 3px solid #c8a800;
    }

    .site-header h1 {
      font-size: 16px;
    }

    .site-header p {
      font-size: 11px;
      color: #c5d8ec;
      margin-top: 2px;
    }

    .screen {
      display: flex;
      flex: 1;
      flex-direction: column;
    }

    .portal-nav {
      background: #1d3f5e;
      display: flex;
      align-items: stretch;
      border-bottom: 2px solid #c8a800;
      flex-shrink: 0;
    }

    .portal-nav a {
      color: #cde;
      text-decoration: none;
      font-size: 12px;
      padding: 8px 12px;
      display: block;
      border-right: 1px solid #00284e;
      cursor: pointer;
      white-space: nowrap;
    }

    .portal-nav a.active {
      color: #fff;
      font-weight: bold;
      border-bottom: 2px solid #c8a800;
    }

    .nav-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      padding: 0 12px;
      font-size: 11px;
      color: #7a9ab8;
      gap: 10px;
    }

    .nav-right a {
      border: none !important;
      padding: 4px 0 !important;
      font-size: 11px;
      color: #7a9ab8;
    }

    .nav-avatar {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      object-fit: cover;
      border: 1px solid #7a9ab8;
      background: #e8e8e8;
    }

    .portal-body {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .sidebar {
      width: 180px;
      background: #e8e8e8;
      border-right: 1px solid #bbb;
      flex-shrink: 0;
      padding: 12px 0;
    }

    .sidebar-user-box {
      padding: 7px 12px 10px;
      border-bottom: 1px solid #ccc;
      margin-bottom: 6px;
      font-size: 11px;
      color: #444;
      line-height: 1.6;
    }

    .sidebar-user-box strong {
      display: block;
      font-size: 12px;
      color: #1a1a1a;
    }

    .sidebar-section {
      font-size: 10px;
      font-weight: bold;
      color: #777;
      text-transform: uppercase;
      letter-spacing: 1px;
      padding: 8px 12px 4px;
    }

    .sidebar-link {
      display: block;
      padding: 5px 12px;
      font-size: 12px;
      color: #1d3f5e;
      text-decoration: none;
      cursor: pointer;
      border-left: 3px solid transparent;
    }

    .sidebar-link.active {
      background: #d0dae8;
      border-left-color: #1d3f5e;
      font-weight: bold;
    }

    .portal-main {
      flex: 1;
      padding: 16px 18px;
      background: #fff;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    .page-title {
      font-size: 15px;
      font-weight: bold;
      color: #1d3f5e;
      border-bottom: 1px solid #ccc;
      padding-bottom: 6px;
      margin-bottom: 10px;
      flex-shrink: 0;
    }

    .map-toolbar {
      border: 1px solid #ccc;
      background: #fafafa;
      padding: 8px;
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 10px;
      flex-shrink: 0;
    }

    .map-toolbar button {
      border: 1px solid #888;
      background: #f0f0f0;
      padding: 5px 10px;
      font-size: 11px;
      cursor: pointer;
    }

    .map-toolbar button:hover {
      background: #e0e0e0;
    }

    .map-layout {
      display: grid;
      grid-template-columns: 1fr 280px;
      gap: 10px;
      flex: 1;
      min-height: 0;
    }

    .map-viewport {
      position: relative;
      overflow: hidden;
      border: 1px solid #aaa;
      background: #ddd;
      cursor: grab;
      min-height: 500px;
    }

    .map-viewport.dragging {
      cursor: grabbing;
    }

    .map-stage {
      position: absolute;
      left: 0;
      top: 0;
      transform-origin: 0 0;
    }

    .map-stage img {
      display: block;
      width: 1600px;
      height: auto;
      user-select: none;
      pointer-events: none;
    }

    .map-overlay {
      position: absolute;
      left: 0;
      top: 0;
      width: 1600px;
      height: 1000px;
      pointer-events: none;
    }

    .map-zone {
      fill: rgba(29, 63, 94, 0.15);
      stroke: rgba(29, 63, 94, 0.85);
      stroke-width: 2;
      cursor: pointer;
      pointer-events: all;
      transition: fill 0.12s ease, stroke 0.12s ease;
    }

    .map-zone:hover {
      fill: rgba(200, 168, 0, 0.35);
      stroke: rgba(200, 168, 0, 1);
    }

    .map-zone.selected {
      fill: rgba(200, 168, 0, 0.5);
      stroke: rgba(120, 80, 0, 1);
      stroke-width: 3;
    }

    .info-panel {
      border: 1px solid #ccc;
      background: #fafafa;
      padding: 10px;
      overflow-y: auto;
    }

    .info-panel h3 {
      font-size: 13px;
      color: #1d3f5e;
      margin-bottom: 8px;
      text-transform: uppercase;
    }

    .info-row {
      border-bottom: 1px solid #ddd;
      padding: 6px 0;
      line-height: 1.5;
    }

    .info-row strong {
      display: block;
      color: #333;
      font-size: 11px;
      text-transform: uppercase;
    }

    .zone-list {
      margin-top: 10px;
    }

    .zone-list button {
      width: 100%;
      text-align: left;
      border: 1px solid #ccc;
      background: #fff;
      padding: 6px;
      margin-bottom: 4px;
      font-size: 11px;
      cursor: pointer;
    }

    .zone-list button:hover {
      background: #eef2f8;
    }

    .page-footer {
      background: #1a1a1a;
      color: #888;
      font-size: 11px;
      text-align: center;
      padding: 7px;
      flex-shrink: 0;
    }

    @media (max-width: 900px) {
      .sidebar {
        display: none;
      }

      .map-layout {
        grid-template-columns: 1fr;
      }

      .nav-right {
        display: none;
      }
    }
  </style>
</head>

<body>
  <div class="gov-banner">U.S. Department of the Navy &nbsp;|&nbsp; Official Government System &nbsp;|&nbsp; Authorized Users Only</div>

  <div class="site-header">
    <h1>Naval Special Warfare Command - Operations Portal</h1>
    <p>NSW-OPS // UNCLASSIFIED // FOR OFFICIAL USE ONLY</p>
  </div>

  <div class="screen">
    <div id="portal-nav" class="portal-nav"></div>

    <div class="portal-body">
      <div id="portal-sidebar" class="sidebar"></div>

      <main class="portal-main">
        <div class="page-title">Map Layout - Midsouth Facility</div>

        <div class="map-toolbar">
          <button id="zoom-in">Zoom In</button>
          <button id="zoom-out">Zoom Out</button>
          <button id="reset-map">Reset</button>
          <span id="zoom-label">100%</span>
        </div>

        <div class="map-layout">
          <div id="map-viewport" class="map-viewport">
            <div id="map-stage" class="map-stage">
              <img src="/assets/maps/midsouth-layout.png" alt="Midsouth Facility Map" draggable="false">
              <svg id="map-overlay" class="map-overlay" viewBox="0 0 1600 1000" preserveAspectRatio="none"></svg>
            </div>
          </div>

          <aside class="info-panel">
            <h3>Selected Area</h3>

            <div class="info-row">
              <strong>Designation</strong>
              <span id="selected-code">None selected</span>
            </div>

            <div class="info-row">
              <strong>Name</strong>
              <span id="selected-name">Hover or click an area.</span>
            </div>

            <div class="info-row">
              <strong>Description</strong>
              <span id="selected-description">Use mouse wheel to zoom. Drag the map to pan.</