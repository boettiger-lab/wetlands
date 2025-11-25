import ibis
from ibis import _
from variables import *
import altair as alt
import re
from branca.element import Template
import pandas as pd

def tpl_style_default(paint,pmtiles):
    source_layer_name = re.sub(r'\W+', '', os.path.splitext(os.path.basename(pmtiles))[0]) #stripping hyphens to get layer name 
    style =  {
    "version": 8,
    "sources": {
        "tpl": {
            "type": "vector",
            "url": "pmtiles://" + pmtiles,
            "attribution": "NWI"
        },
    },
    "layers": [{
            "id": "nwi",
            "source": "nwi",
            "source-layer": source_layer_name,
            "type": "fill",
            "paint": {
                "fill-color": paint,
                "fill-opacity": 1
            }
        }]
    }
    return style

def tpl_style(ids, paint, pmtiles):
    source_layer_name = re.sub(r'\W+', '', os.path.splitext(os.path.basename(pmtiles))[0]) #stripping hyphens to get layer name 
    style =  {
    "version": 8,
    "sources": {
        "tpl": {
            "type": "vector",
            "url": "pmtiles://" + pmtiles,
            "attribution": "NWI"
        },
    },
    "layers": [{
            "id": "nwi",
            "source": "nwi",
            "source-layer": source_layer_name,
            "type": "fill",
            'filter': ['in', ['get', 'fid'], ["literal", ids]],
            "paint": {
                "fill-color": paint,
                "fill-opacity": 1
            }
        }]
    }
    return style


def get_legend(paint, df = None, column = None):
    """
    Generates a legend dictionary with color mapping and formatting adjustments.
    """
    if 'stops' in paint:
        legend = {cat: color for cat, color in paint['stops']}
    else:
        legend = {}
    if df is not None:
        if ~df.empty:
            categories = df[column].to_list() #if we filter out categories, don't show them on the legend 
            legend = {cat: color for cat, color in legend.items() if str(cat) in categories}
    position, fontsize, bg_color = 'bottom-right', 15, 'white'
    controls={'navigation': 'bottom-left', 
              'fullscreen':'bottom-left'}
    shape_type = 'circle'

    return legend, position, bg_color, fontsize, shape_type, controls 


    
minio_key = os.getenv("MINIO_KEY")
if minio_key is None:
    minio_key = st.secrets["MINIO_KEY"]

minio_secret = os.getenv("MINIO_SECRET")
if minio_secret is None:
    minio_secret = st.secrets["MINIO_SECRET"]

def minio_logger(consent, query, sql_query, llm_explanation, llm_choice, filename="query_log.csv", bucket="public-wetlands",
                 key=minio_key, secret=minio_secret,
                 endpoint="minio.carlboettiger.info"):
    mc = minio.Minio(endpoint, key, secret)
    mc.fget_object(bucket, filename, filename)
    log = pd.read_csv(filename)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    if consent:
        df = pd.DataFrame({"timestamp": [timestamp], "user_query": [query], "llm_sql": [sql_query], "llm_explanation": [llm_explanation], "llm_choice":[llm_choice]})

    # if user opted out, do not store query
    else:  
        df = pd.DataFrame({"timestamp": [timestamp], "user_query": ['USER OPTED OUT'], "llm_sql": [''], "llm_explanation": [''], "llm_choice":['']})
    
    pd.concat([log,df]).to_csv(filename, index=False, header=True)
    mc.fput_object(bucket, filename, filename, content_type="text/csv")
