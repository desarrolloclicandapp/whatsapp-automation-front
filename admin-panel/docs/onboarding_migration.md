# Onboarding Migration Guide

## What Changed in the Agency Dashboard?

The process of creating and connecting new sub-accounts has been redesigned to provide a smoother, step-by-step onboarding experience.

### 1. Removal of Integration Selection Cards from the Overview

Previously, users had to select which integration (GoHighLevel or Chatwoot) they wanted globally for their session using large selection cards at the top of the Overview panel.

**These cards have been completely removed from the Overview.**
The selection of the CRM/Messaging platform is now done **per account** when creating a new location, rather than globally for the entire dashboard visibility.

### 2. New Integration Filter Tabs

Instead of switching the entire dashboard mode between GHL and Chatwoot, you now have a unified view of all your accounts.
We introduced filter tabs (`All` | `GoHighLevel` | `Chatwoot`) right above the accounts list.
By default, you can see all your accounts side-by-side, regardless of their CRM connection. Each account card now displays a small colored badge indicating its integration type.

### 3. The New Onboarding Wizard

When you click **"+ New Account"** (or click on an empty slot card), a new multi-step Onboarding Modal opens:

- **Step 1:** Choose the integration type strictly for this new account (GoHighLevel or Chatwoot).
- **Step 2:** Choose the connection method.
  - For **GoHighLevel**: You can link an existing location (by installing our app) OR use our new integration to **create a sub-account directly under the agency** from within Waflow.
  - For **Chatwoot**: You can link an external instance (BYOC) OR request a self-hosted account provisioned by our team.

### 4. Settings View Revisions

The "Integrations" section in the `Settings` tab remains, but its purpose has subtly shifted.
It now serves as a reference panel showing the available core integrations for your agency level. Master config credentials for default self-hosted Chatwoot still need to be populated in the settings if you offer Chatwoot provisioning to your clients.

## Summary

You no longer need to switch your dashboard state up and down to manage GHL vs. Chatwoot sub-accounts. Operations are now account-centric rather than session-centric.
