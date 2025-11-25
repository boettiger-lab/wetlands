import os
import ibis
from ibis import _
import ibis.selectors as s
from cng.utils import *
from cng.h3 import *
from minio import Minio
from datetime import datetime, timedelta
import streamlit
import re
import traceback
duckdb_install_h3()

con = ibis.duckdb.connect(extensions = ["spatial", "h3"])
con.raw_sql("SET THREADS=100;")
set_secrets(con, "", "", "minio.carlboettiger.info")

pmtiles = "https://minio.carlboettiger.info/public-tpl/conservation_almanac/tpl.pmtiles"
mobi_z8_url = "https://minio.carlboettiger.info/public-mobi/hex/all-richness-h8.parquet"
svi_z8_url = "https://minio.carlboettiger.info/public-social-vulnerability/2022/SVI2022_US_tract_h3_z8.parquet"
carbon_z8_url = "https://minio.carlboettiger.info/public-carbon/hex/us-tracts-vuln-total-carbon-2018-h8.parquet"

us_wetlands_z8 = con.read_parquet("s3://public-wetlands/hex/**", table_name = 'us_wetlands')
global_wetlands_z8 = con.read_parquet("s3://public-wetlands/hex/**", table_name = 'global_wetlands')
mobi_z8 = con.read_parquet(mobi_z8_url, table_name = 'mobi')
svi_z8 = con.read_parquet(svi_z8_url,table_name = 'svi')
carbon_z8 = con.read_parquet(carbon_z8_url, table_name = 'carbon')
us_wetlands_geoms = con.read_parquet("s3://public-nwi/geoms/*")

# Define color hex codes
darkblue = "#00008B"
blue = "#0096FF"
lightblue = "#ADD8E6"
darkgreen = "#006400"
grey = "#c4c3c3"
dark_grey = "#5a5a5a"
green = "#008000"
purple = "#800080"
darkred = "#8B0000"

style_options = {
    "Wetland Type":  {
            'property': 'manager_type',
            'type': 'categorical',
            'stops': [
                ['Freshwater Forested/Shrub Wetland', darkblue],
                ['Freshwater Emergent Wetland', blue],
                ['Freshwater Pond', lightblue],
                ['Estuarine and Marine Wetland', darkgreen],
                ['Riverine', dark_grey],
                ['Lake', green],
                ['Estuarine and Marine Deepwater', purple],
                ['Other', darkred],
            ]
            },

    }


style_choice_columns = {'Wetland Type': style_options['Wetland Type']['property'],
             }


#maplibregl tooltip 
tooltip_cols = ['ATTRIBUTE','WETLAND_TYPE']
tooltip_template = "<br>".join([f"{col}: {{{{ {col} }}}}" for col in tooltip_cols])


error_messages = {
    "bad_request": lambda llm, e, tb_str: f"""
**Error – LLM Unavailable** 

*The LLM you selected `{llm}` is no longer available. Please select a different model.*

**Error Details:**
`{type(e)}: {e}`

""",

    "internal_server_error": lambda llm, e, tb_str: f"""
**Error – LLM Temporarily Unavailable**

The LLM you selected `{llm}` is currently down due to maintenance or provider outages. It may remain offline for several hours.

**Please select a different model or try again later.**

**Error Details:**
`{type(e)}: {e}`

""",

    "unexpected_llm_error": lambda prompt, e, tb_str: f"""
🐞 **BUG: Unexpected Error in Application**

An error occurred while processing your query:

> "{prompt}"

**Error Details:**
`{type(e)}: {e}`

Traceback:

```{tb_str}```
---

🚨 **Help Us Improve!**

Please help us fix this issue by reporting it on GitHub:
[📄 Report this issue](https://github.com/boettiger-lab/CBN-taskforce/issues)

Include the query you ran and any other relevant details. Thanks!
""",

    "unexpected_error": lambda e, tb_str: f"""
🐞 **BUG: Unexpected Error in Application**


**Error Details:**
`{type(e)}: {e}`

Traceback:

```{tb_str}```

---

🚨 **Help Us Improve!**

Please help us fix this issue by reporting it on GitHub:
[📄 Report this issue](https://github.com/boettiger-lab/CBN-taskforce/issues)

Include the steps you took to get this message and any other details that might help us debug. Thanks!
"""
}


from langchain_openai import ChatOpenAI
import streamlit as st
from langchain_openai.chat_models.base import BaseChatOpenAI

## dockerized streamlit app wants to read from os.getenv(), otherwise use st.secrets
import os
api_key = os.getenv("NRP_API_KEY")
if api_key is None:
    api_key = st.secrets["NRP_API_KEY"]

openrouter_api = os.getenv("OPENROUTER_API_KEY")
if openrouter_api is None:
    openrouter_api = st.secrets["OPENROUTER_API_KEY"]

openrouter_endpoint="https://openrouter.ai/api/v1"
nrp_endpoint="http://ellm.nrp-nautilus.io/v1"

# don't use a provider that collects data
data_policy = {
    "provider": {
        "data_collection": "deny"
    }
}

llm_options = {
     "kat-coder-pro": ChatOpenAI(
        model="kwaipilot/kat-coder-pro:free",
        api_key=openrouter_api,
        base_url=openrouter_endpoint,
        temperature=0,
        extra_body=data_policy
    ),

    "llama-3.3-70b-instruct": ChatOpenAI(
        model="meta-llama/llama-3.3-70b-instruct:free",
        api_key=openrouter_api,
        base_url=openrouter_endpoint,
        temperature=0,
        extra_body=data_policy
    ),
        
    "gpt-oss-20b": ChatOpenAI(
        model="openai/gpt-oss-20b:free",
        api_key=openrouter_api,
        base_url=openrouter_endpoint,
        temperature=0,
        extra_body=data_policy
    ),
    
    "qwen3-coder": ChatOpenAI(
        model="qwen/qwen3-coder:free",
        api_key=openrouter_api,
        base_url=openrouter_endpoint,
        temperature=0,
        extra_body=data_policy
    ),  
    
    "dolphin-mistral-24b-venice-edition": ChatOpenAI(
        model="cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        api_key=openrouter_api,
        base_url=openrouter_endpoint,
        temperature=0,
        extra_body=data_policy
    ),

    "nemotron-nano-9b-v2": ChatOpenAI(
        model="nvidia/nemotron-nano-9b-v2:free",
        api_key=openrouter_api,
        base_url=openrouter_endpoint,
        temperature=0,
        extra_body=data_policy
    ),

    "olmo-2-0325-32b-instruct": ChatOpenAI(
        model="olmo",
        api_key=api_key,
        base_url=nrp_endpoint,
        temperature=0
    ),
}
